"""Core embedding, Chroma vector store, and query/ingest orchestration for GramSahayak RAG."""

import json
import logging
import os
import threading
import time
from pathlib import Path
from typing import Any, List, Optional, Tuple

import chromadb
from chromadb.config import Settings as ChromaSettings
from fastapi import HTTPException
from huggingface_hub import try_to_load_from_cache
from langchain_core.documents import Document

from app.config import settings
from app.llm import llm_state
from app.schemas import (
    RagIngestRequest,
    RagIngestResponse,
    RagQueryRequest,
    RagQueryResponse,
    RagRetrieveResponse,
    RetrieveChunkItem,
    SourceItem,
)

logger = logging.getLogger("gramsahayak.rag")

# Silence broken posthog telemetry in chromadb 0.6.x
try:
    import posthog

    posthog.disabled = True
    posthog.capture = lambda *args, **kwargs: None  # type: ignore[assignment]
except Exception:
    pass


def _cosine_distance_to_similarity(distance: float) -> float:
    """Convert Chroma cosine distance (1 - cos_sim) into normalized [0.0, 1.0] similarity."""
    sim = 1.0 - float(distance)
    return max(0.0, min(1.0, round(sim, 4)))


class RagEngine:
    """Singleton manager holding the loaded HuggingFace embedding model and ChromaDB collection."""

    def __init__(self) -> None:
        self.embeddings: Optional[Any] = None
        self.chroma_client: Optional[chromadb.ClientAPI] = None
        self.vectorstore: Optional[Any] = None
        self.load_time_ms: int = 0
        self.ready: bool = False
        self._embed_ready = threading.Event()
        self._init_lock = threading.Lock()

    def _open_chroma_client(self) -> None:
        if self.chroma_client is None:
            settings.CHROMA_DIR.mkdir(parents=True, exist_ok=True)
            self.chroma_client = chromadb.PersistentClient(
                path=str(settings.CHROMA_DIR),
                settings=ChromaSettings(anonymized_telemetry=False),
            )
            self.chroma_client.get_or_create_collection(
                name=settings.CHROMA_COLLECTION,
                metadata={"hnsw:space": "cosine"},
            )

    def ensure_initialized_sync(self) -> None:
        """Synchronously initialize Chroma and the embedding model (used by ingest.py CLI)."""
        with self._init_lock:
            t0 = time.perf_counter()
            self._open_chroma_client()
            self.ready = True
            if not self._embed_ready.is_set():
                self._load_embedding_model(t0, auto_ingest_if_empty=False)

    def initialize(self) -> None:
        """Open persistent ChromaDB collection immediately and load embedding model at startup."""
        t0 = time.perf_counter()
        self._open_chroma_client()
        self.ready = True

        loader_thread = threading.Thread(
            target=self._load_embedding_model,
            args=(t0, True),
            daemon=True,
        )
        loader_thread.start()
        loader_thread.join(timeout=2.5)

    def _bind_vectorstore(self) -> None:
        from langchain_chroma import Chroma

        self.vectorstore = Chroma(
            client=self.chroma_client,
            collection_name=settings.CHROMA_COLLECTION,
            embedding_function=self.embeddings,
            collection_metadata={"hnsw:space": "cosine"},
        )

    def _load_embedding_model(self, t0: float, auto_ingest_if_empty: bool = True) -> None:
        try:
            logger.info("Loading embedding model '%s'...", settings.EMBED_MODEL)
            cached_cfg = try_to_load_from_cache(settings.EMBED_MODEL, "config.json")
            use_local_only = isinstance(cached_cfg, str)
            if use_local_only:
                os.environ.setdefault("HF_HUB_OFFLINE", "1")
                os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")

            from langchain_huggingface import HuggingFaceEmbeddings

            self.embeddings = HuggingFaceEmbeddings(
                model_name=settings.EMBED_MODEL,
                model_kwargs={"device": "cpu", "local_files_only": use_local_only},
                encode_kwargs={"normalize_embeddings": True},
            )
            self._bind_vectorstore()
            self.embeddings.embed_query("query: PM Kisan")
            self.load_time_ms = int((time.perf_counter() - t0) * 1000)
            self._embed_ready.set()

            vec_count = self.get_vector_count()
            logger.info(
                "Embedding model '%s' and Chroma initialized in %d ms (vector_count=%d, chroma_dir=%s)",
                settings.EMBED_MODEL,
                self.load_time_ms,
                vec_count,
                settings.CHROMA_DIR,
            )

            # RAG-02 requirement 4: Run automatically on startup when vector_count is 0
            if auto_ingest_if_empty and vec_count == 0:
                logger.info("Chroma vector_count is 0 on startup; running automatic seed ingest...")
                from ingest import run_seed_ingest

                run_seed_ingest(reset=False)
        except Exception as exc:
            logger.error("Failed to load embedding model '%s': %s", settings.EMBED_MODEL, exc)
            self._embed_ready.set()

    def ensure_embeddings_ready(self, timeout: float = 30.0) -> None:
        if not self._embed_ready.is_set():
            self._embed_ready.wait(timeout=timeout)

    def reset_collection(self) -> None:
        """Delete and recreate the Chroma collection."""
        self.ensure_embeddings_ready()
        assert self.chroma_client is not None
        try:
            self.chroma_client.delete_collection(name=settings.CHROMA_COLLECTION)
        except Exception:
            pass
        self.chroma_client.get_or_create_collection(
            name=settings.CHROMA_COLLECTION,
            metadata={"hnsw:space": "cosine"},
        )
        self._bind_vectorstore()

    def upsert_documents(self, items: List[Tuple[str, Document]]) -> int:
        """Idempotently upsert (id, Document) pairs into Chroma."""
        if not items:
            return 0
        self.ensure_embeddings_ready()
        assert self.vectorstore is not None

        ids = [doc_id for doc_id, _ in items]
        docs = [doc for _, doc in items]
        self.vectorstore.add_documents(documents=docs, ids=ids)
        return len(items)

    def get_vector_count(self) -> int:
        if self.chroma_client is None:
            return 0
        try:
            collection = self.chroma_client.get_or_create_collection(
                name=settings.CHROMA_COLLECTION,
                metadata={"hnsw:space": "cosine"},
            )
            return int(collection.count())
        except Exception as exc:
            logger.warning("Failed to read Chroma vector count: %s", exc)
            return 0

    def _resolve_repo_path(self, raw_path: str) -> Path:
        """Resolve an absolute or repo-relative path and reject any path outside REPO_ROOT."""
        candidate = Path(raw_path)
        if not candidate.is_absolute():
            candidate = settings.REPO_ROOT / candidate
        resolved = candidate.resolve()
        repo_root = settings.REPO_ROOT.resolve()
        if not resolved.is_relative_to(repo_root):
            raise HTTPException(
                status_code=400,
                detail="Invalid file_path: path must be inside the repository root.",
            )
        if not resolved.exists() or not resolved.is_file():
            raise HTTPException(
                status_code=404,
                detail=f"File not found: {raw_path}",
            )
        return resolved

    def ingest_file(self, req: RagIngestRequest) -> RagIngestResponse:
        """Ingest a single file (.md, .txt, .pdf, .json) inside the repo into Chroma."""
        self.ensure_embeddings_ready()
        target_path = self._resolve_repo_path(req.file_path)

        from ingest import load_raw_file_documents

        try:
            items = load_raw_file_documents(target_path, category=req.category)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        ingested_count = self.upsert_documents(items)
        return RagIngestResponse(
            ingested_chunks=ingested_count,
            vector_count=self.get_vector_count(),
        )

    def search_chunks(
        self,
        query: str,
        category: Optional[str] = None,
        k: Optional[int] = None,
    ) -> List[Tuple[Document, float]]:
        """Run cosine similarity search with 'query: ' prefix and optional category metadata filter."""
        self.ensure_embeddings_ready()
        if self.vectorstore is None or self.get_vector_count() == 0:
            return []

        top_k = k or settings.RAG_TOP_K
        prefixed_query = query if query.startswith("query: ") else f"query: {query}"
        filter_dict = {"category": category} if category else None

        results_with_dist = self.vectorstore.similarity_search_with_score(
            prefixed_query,
            k=top_k,
            filter=filter_dict,
        )
        scored: List[Tuple[Document, float]] = [
            (doc, _cosine_distance_to_similarity(dist))
            for doc, dist in results_with_dist
        ]
        scored.sort(key=lambda item: item[1], reverse=True)
        return scored

    def retrieve(self, req: RagQueryRequest) -> RagRetrieveResponse:
        """Return raw retrieved chunks and matched_scheme_id for POST /rag/retrieve."""
        top_k = 3 if req.for_voice else settings.RAG_TOP_K
        scored = self.search_chunks(req.query, category=req.category, k=top_k)

        matched_scheme_id: Optional[str] = None
        if scored:
            top_doc, top_sim = scored[0]
            if (
                top_doc.metadata.get("kind") == "scheme"
                and top_sim >= settings.RAG_MATCH_THRESHOLD
            ):
                matched_scheme_id = str(top_doc.metadata.get("code") or top_doc.metadata.get("id"))

        chunks = [
            RetrieveChunkItem(
                id=str(doc.metadata.get("id") or doc.metadata.get("code") or "CHUNK"),
                title=str(doc.metadata.get("title") or "Untitled"),
                category=doc.metadata.get("category") or (req.category or "schemes"),
                text=doc.page_content.removeprefix("passage: ").strip(),
                score=sim,
            )
            for doc, sim in scored
        ]
        return RagRetrieveResponse(chunks=chunks, matched_scheme_id=matched_scheme_id)

    def query(self, req: RagQueryRequest) -> RagQueryResponse:
        """Execute RAG query (preliminary extractive retrieval; full LCEL chain arrives in RAG-03)."""
        t0 = time.perf_counter()
        top_k = 3 if req.for_voice else settings.RAG_TOP_K
        scored = self.search_chunks(req.query, category=req.category, k=top_k)

        if not scored:
            default_messages = {
                "hi-IN": "ग्राम सहायक सेवा तैयार है। अधिक जानकारी के लिए किसान कॉल सेंटर 1800-180-1551 या हेल्पलाइन 104 पर संपर्क करें।",
                "mr-IN": "ग्राम सहायक सेवा तयार आहे. अधिक माहितीसाठी किसान कॉल सेंटर 1800-180-1551 किंवा हेल्पलाईन 104 वर संपर्क साधा.",
                "ta-IN": "கிராம் சஹாயக் சேவை தயாராக உள்ளது. மேலும் விவரங்களுக்கு கிசான் அழைப்பு மையம் 1800-180-1551 அல்லது 104 எண்ணை தொடர்பு கொள்ளவும்.",
                "en-IN": "GramSahayak RAG service is online. For verified assistance please call Kisan Call Centre 1800-180-1551 or helpline 104.",
            }
            answer = default_messages.get(req.language, default_messages["en-IN"])
            elapsed_ms = int((time.perf_counter() - t0) * 1000)
            return RagQueryResponse(
                answer=answer,
                sources=[],
                matched_scheme_id=None,
                sms_summary=None,
                confidence=0.0,
                mode=llm_state.current_mode,
                latency_ms=elapsed_ms,
            )

        top_doc, top_sim = scored[0]
        matched_scheme_id: Optional[str] = None
        sms_summary: Optional[str] = None

        if top_doc.metadata.get("kind") == "scheme" and top_sim >= settings.RAG_MATCH_THRESHOLD:
            matched_scheme_id = str(top_doc.metadata.get("code") or top_doc.metadata.get("id"))
            raw_sms = top_doc.metadata.get("sms_summary")
            if raw_sms:
                try:
                    sms_map = json.loads(raw_sms) if isinstance(raw_sms, str) else raw_sms
                    sms_summary = sms_map.get(req.language) or sms_map.get("en-IN")
                except Exception:
                    sms_summary = None

        sources: List[SourceItem] = []
        seen_ids: set[str] = set()
        for doc, _sim in scored:
            src_id = str(doc.metadata.get("code") or doc.metadata.get("id") or "SOURCE")
            if src_id in seen_ids:
                continue
            seen_ids.add(src_id)
            sources.append(
                SourceItem(
                    id=src_id,
                    title=str(doc.metadata.get("title") or src_id),
                    category=doc.metadata.get("category") or "schemes",
                    helpline=str(doc.metadata.get("helpline") or "1800-180-1551"),
                    portal=str(doc.metadata.get("portal_url") or "https://pmkisan.gov.in"),
                )
            )

        answer_text = sms_summary or top_doc.page_content.removeprefix("passage: ").strip()[:360]
        elapsed_ms = int((time.perf_counter() - t0) * 1000)
        return RagQueryResponse(
            answer=answer_text,
            sources=sources,
            matched_scheme_id=matched_scheme_id,
            sms_summary=sms_summary,
            confidence=top_sim,
            mode=llm_state.current_mode,
            latency_ms=elapsed_ms,
        )


rag_engine = RagEngine()
