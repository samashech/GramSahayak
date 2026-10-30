"""Core embedding, Chroma vector store, and LCEL query/ingest orchestration for GramSahayak RAG (RAG-03)."""

import json
import logging
import os
import re
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
from app.llm import invoke_lcel_answer, llm_state
from app.prompts import GUIDE_LOCALISED_SUMMARIES, VOICE_CLOSING_BY_LANG
from app.safety import check_safety_override
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


def _clean_for_voice(text: str, language: str) -> str:
    """Enforce for_voice rules: plain text, no URLs/markdown/lists, max 3 short sentences."""
    cleaned = re.sub(r"https?://\S+", "", text)
    cleaned = re.sub(r"\b[a-zA-Z0-9.-]+\.(?:gov|nic)\.in(?:/\S*)?", "", cleaned)
    cleaned = re.sub(r"[*_`#>\[\]]+", "", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    sentences = [
        s.strip()
        for s in re.split(r"(?<=[.।!?])\s+", cleaned)
        if s.strip()
    ]
    if len(sentences) > 3:
        sentences = sentences[:3]
    result = " ".join(sentences).strip()
    if not result:
        result = VOICE_CLOSING_BY_LANG.get(language, VOICE_CLOSING_BY_LANG["en-IN"])
    return result


def _extract_two_relevant_sentences(chunk_text: str, helpline: str) -> str:
    """Extract the two most relevant content sentences from a guide chunk plus helpline."""
    body = chunk_text.removeprefix("passage: ").strip()
    lines = [
        ln.strip().lstrip("-*0123456789. ").strip()
        for ln in body.splitlines()
        if ln.strip() and not ln.strip().startswith("#") and "|" not in ln
    ]
    combined = " ".join(lines)
    sentences = [
        s.strip()
        for s in re.split(r"(?<=[.।!?])\s+", combined)
        if len(s.strip()) > 15
    ]
    selected = ". ".join(s.rstrip(".") for s in sentences[:2]).strip()
    if selected and not selected.endswith((".", "।", "!", "?")):
        selected += "."
    if helpline and helpline not in selected:
        selected = f"{selected} Helpline: {helpline}." if selected else f"Helpline: {helpline}."
    return selected or body[:280]


def _build_extractive_answer(
    top_doc: Document,
    language: str,
    for_voice: bool,
    sms_summary: Optional[str],
) -> str:
    """
    Build a grounded extractive answer in the user's requested language when Groq is unavailable
    or MOCK_LLM=true (RAG-03 / RAG-05).
    """
    kind = top_doc.metadata.get("kind")
    helpline = str(top_doc.metadata.get("helpline") or "1800-180-1551")

    if kind == "scheme":
        lang_prefix = language.split("-")[0]
        local_name = (
            top_doc.metadata.get(f"name_{lang_prefix}")
            or top_doc.metadata.get("name_en")
            or top_doc.metadata.get("title")
            or ""
        )
        if sms_summary:
            ans = f"{local_name}: {sms_summary}" if local_name and local_name not in sms_summary else sms_summary
            if helpline and helpline not in ans:
                ans = f"{ans} ({helpline})"
        else:
            ans = _extract_two_relevant_sentences(top_doc.page_content, helpline)
        if for_voice:
            closing = VOICE_CLOSING_BY_LANG.get(language, VOICE_CLOSING_BY_LANG["en-IN"])
            return _clean_for_voice(f"{ans} {closing}", language)
        return ans

    # Guide chunk: check if we have a curated regional-language summary for this guide topic
    heading_lower = str(top_doc.metadata.get("title") or top_doc.page_content[:200]).lower()
    for topic_key, lang_map in GUIDE_LOCALISED_SUMMARIES:
        if topic_key in heading_lower and language in lang_map:
            ans = lang_map[language]
            if for_voice:
                closing = VOICE_CLOSING_BY_LANG.get(language, VOICE_CLOSING_BY_LANG["en-IN"])
                return _clean_for_voice(f"{ans} {closing}", language)
            return ans

    ans = _extract_two_relevant_sentences(top_doc.page_content, helpline)
    if for_voice:
        return _clean_for_voice(ans, language)
    return ans


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

    def search_chunks_timed(
        self,
        query: str,
        category: Optional[str] = None,
        k: Optional[int] = None,
    ) -> Tuple[List[Tuple[Document, float]], float, float]:
        """
        Embed query with 'query: ' prefix and query Chroma separately so embed_ms and retrieve_ms
        are logged distinctly (RAG-03 requirement 7).
        """
        self.ensure_embeddings_ready()
        if self.embeddings is None or self.chroma_client is None or self.get_vector_count() == 0:
            return [], 0.0, 0.0

        top_k = k or settings.RAG_TOP_K
        prefixed_query = query if query.startswith("query: ") else f"query: {query}"

        t_emb0 = time.perf_counter()
        query_vector = self.embeddings.embed_query(prefixed_query)
        embed_ms = (time.perf_counter() - t_emb0) * 1000.0

        t_ret0 = time.perf_counter()
        collection = self.chroma_client.get_or_create_collection(
            name=settings.CHROMA_COLLECTION,
            metadata={"hnsw:space": "cosine"},
        )
        where_filter = {"category": category} if category else None
        raw_res = collection.query(
            query_embeddings=[query_vector],
            n_results=top_k,
            where=where_filter,
            include=["documents", "metadatas", "distances"],
        )
        retrieve_ms = (time.perf_counter() - t_ret0) * 1000.0

        docs_list = (raw_res.get("documents") or [[]])[0]
        metas_list = (raw_res.get("metadatas") or [[]])[0]
        dists_list = (raw_res.get("distances") or [[]])[0]

        scored: List[Tuple[Document, float]] = []
        for doc_text, meta, dist in zip(docs_list, metas_list, dists_list):
            doc = Document(page_content=doc_text or "", metadata=meta or {})
            scored.append((doc, _cosine_distance_to_similarity(dist)))

        scored.sort(key=lambda item: item[1], reverse=True)
        return scored, embed_ms, retrieve_ms

    def search_chunks(
        self,
        query: str,
        category: Optional[str] = None,
        k: Optional[int] = None,
    ) -> List[Tuple[Document, float]]:
        scored, _emb_ms, _ret_ms = self.search_chunks_timed(query, category=category, k=k)
        return scored

    def retrieve(self, req: RagQueryRequest) -> RagRetrieveResponse:
        """Return raw retrieved chunks and matched_scheme_id for POST /rag/retrieve."""
        top_k = 3 if req.for_voice else settings.RAG_TOP_K
        scored, _emb_ms, _ret_ms = self.search_chunks_timed(req.query, category=req.category, k=top_k)

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
        """Execute the LangChain retrieval-and-answer chain (RAG-03)."""
        t0 = time.perf_counter()

        # Check safety overrides (hook for RAG-04)
        safety_override = check_safety_override(req.query, req.language, req.category)
        if safety_override is not None:
            elapsed_ms = int((time.perf_counter() - t0) * 1000)
            return RagQueryResponse(
                answer=safety_override["answer"],
                sources=safety_override.get("sources", []),
                matched_scheme_id=None,
                sms_summary=None,
                confidence=safety_override.get("confidence", 1.0),
                mode=safety_override.get("mode", llm_state.current_mode),
                latency_ms=elapsed_ms,
            )

        top_k = 3 if req.for_voice else settings.RAG_TOP_K
        scored, embed_ms, retrieve_ms = self.search_chunks_timed(
            req.query,
            category=req.category,
            k=top_k,
        )

        # If category filter returned no high-confidence hit, retry unfiltered so cross-category scheme queries still work
        if req.category and (not scored or scored[0][1] < settings.RAG_MATCH_THRESHOLD):
            unfiltered_scored, emb2_ms, ret2_ms = self.search_chunks_timed(
                req.query,
                category=None,
                k=top_k,
            )
            embed_ms += emb2_ms
            retrieve_ms += ret2_ms
            if unfiltered_scored and (not scored or unfiltered_scored[0][1] > scored[0][1] + 0.02):
                scored = unfiltered_scored

        if not scored:
            default_messages = {
                "hi-IN": "हमारे पास इस विषय पर सत्यापित जानकारी नहीं है। कृपया किसान कॉल सेंटर 1800-180-1551 या हेल्पलाइन 104 पर संपर्क करें।",
                "mr-IN": "आमच्याकडे या विषयावर सत्यापित माहिती नाही. कृपया किसान कॉल सेंटर 1800-180-1551 किंवा हेल्पलाईन 104 वर संपर्क साधा.",
                "ta-IN": "இது குறித்த சரிபார்க்கப்பட்ட தகவல் எங்களிடம் இல்லை. தயவுசெய்து கிசான் அழைப்பு மையம் 1800-180-1551 அல்லது 104 எண்ணை அழைக்கவும்.",
                "en-IN": "We do not have verified information on this topic. Please call Kisan Call Centre 1800-180-1551 or helpline 104.",
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
        context_blocks: List[str] = []
        for idx, (doc, sim) in enumerate(scored, start=1):
            src_id = str(doc.metadata.get("code") or doc.metadata.get("id") or f"SRC_{idx}")
            if src_id not in seen_ids:
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
            clean_chunk = doc.page_content.removeprefix("passage: ").strip()
            context_blocks.append(f"[{idx}] ({src_id}, score={sim:.3f}):\n{clean_chunk}")

        context_str = "\n\n".join(context_blocks)
        llm_ms = 0.0
        mode_used = llm_state.current_mode

        if mode_used == "llm":
            t_llm0 = time.perf_counter()
            try:
                answer_text = invoke_lcel_answer(
                    question=req.query,
                    context=context_str,
                    language=req.language,
                    role=req.role,
                    for_voice=req.for_voice,
                    history=req.history,
                )
                if req.for_voice:
                    answer_text = _clean_for_voice(answer_text, req.language)
                mode_used = "llm"
            except Exception as exc:
                logger.warning("Groq LCEL call failed (%s); falling back to extractive answer.", exc)
                llm_state.record_failure()
                mode_used = "extractive"
                answer_text = _build_extractive_answer(
                    top_doc=top_doc,
                    language=req.language,
                    for_voice=req.for_voice,
                    sms_summary=sms_summary,
                )
            llm_ms = (time.perf_counter() - t_llm0) * 1000.0
        else:
            answer_text = _build_extractive_answer(
                top_doc=top_doc,
                language=req.language,
                for_voice=req.for_voice,
                sms_summary=sms_summary,
            )

        elapsed_ms = int((time.perf_counter() - t0) * 1000)
        logger.info(
            "RAG /rag/query lang=%s cat=%s role=%s voice=%s matched=%s conf=%.4f mode=%s | embed=%.1fms retrieve=%.1fms llm=%.1fms total=%dms",
            req.language,
            req.category,
            req.role,
            req.for_voice,
            matched_scheme_id,
            top_sim,
            mode_used,
            embed_ms,
            retrieve_ms,
            llm_ms,
            elapsed_ms,
        )

        return RagQueryResponse(
            answer=answer_text,
            sources=sources,
            matched_scheme_id=matched_scheme_id,
            sms_summary=sms_summary,
            confidence=top_sim,
            mode=mode_used,
            latency_ms=elapsed_ms,
        )


rag_engine = RagEngine()
