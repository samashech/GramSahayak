"""Core embedding, Chroma vector store, in-process cache, and LCEL/extractive orchestration (RAG-03..RAG-05)."""

from collections import OrderedDict
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
from app.llm import invoke_lcel_answer, llm_state, parse_answer_json
from app.prompts import (
    GUIDE_LOCALISED_SUMMARIES,
    SYSTEM_PROMPT_TEMPLATE,
    VOICE_CLOSING_BY_LANG,
    VOICE_INSTRUCTION,
)
from app.safety import (
    build_out_of_scope_override,
    check_safety_override,
    sanitize_retrieved_context,
)
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

CacheKey = Tuple[str, str, str, bool]


class QueryResponseCache:
    """
    Tiny in-process LRU + TTL cache keyed by (query, language, category, for_voice)
    for repeated demo questions (max 200 entries, 10 minutes / 600 seconds) (RAG-05 requirement 5).
    """

    def __init__(self, max_entries: int = 200, ttl_seconds: float = 600.0) -> None:
        self.max_entries = max_entries
        self.ttl_seconds = ttl_seconds
        self._store: OrderedDict[CacheKey, Tuple[float, dict[str, Any]]] = OrderedDict()
        self._lock = threading.Lock()

    def get(self, key: CacheKey) -> Optional[dict[str, Any]]:
        now = time.time()
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            ts, payload = entry
            if (now - ts) > self.ttl_seconds:
                self._store.pop(key, None)
                return None
            self._store.move_to_end(key)
            return dict(payload)

    def set(self, key: CacheKey, payload: dict[str, Any]) -> None:
        now = time.time()
        with self._lock:
            if key in self._store:
                self._store.move_to_end(key)
            self._store[key] = (now, dict(payload))
            while len(self._store) > self.max_entries:
                self._store.popitem(last=False)

    def clear(self) -> None:
        with self._lock:
            self._store.clear()


def _cosine_distance_to_similarity(distance: float) -> float:
    """Convert Chroma cosine distance (1 - cos_sim) into normalized [0.0, 1.0] similarity."""
    sim = 1.0 - float(distance)
    return max(0.0, min(1.0, round(sim, 4)))


def _is_prompt_intact() -> bool:
    """Verify that SYSTEM_PROMPT_TEMPLATE in app.prompts retains required grounding and language directives."""
    required_clauses = (
        "Answer ONLY from the CONTEXT",
        "{language_name}",
        "Never invent amounts",
        "1800-180-1551",
    )
    return all(clause in SYSTEM_PROMPT_TEMPLATE for clause in required_clauses)


_LLM_BLOCK_CHARS = 900
_SOURCE_REF_RE = re.compile(r"\s*[(\[]\s*(?:GUIDE_?[A-Z_]*\d+|[A-Z][A-Z_]{1,12}|\d{1,2})(?:\s*,\s*score=[0-9.]+)?\s*[)\]]")
_HELPLINE_WORD = {"hi-IN": "हेल्पलाइन", "mr-IN": "हेल्पलाइन", "gu-IN": "હેલ્પલાઇન", "ta-IN": "உதவி எண்", "en-IN": "Helpline"}


def _sms_summary_of(doc: Document, language: str) -> Optional[str]:
    """The card's sms_summary in the request language (en-IN fallback), from Chroma metadata."""
    raw_sms = doc.metadata.get("sms_summary")
    if not raw_sms:
        return None
    try:
        sms_map = json.loads(raw_sms) if isinstance(raw_sms, str) else raw_sms
        return sms_map.get(language) or sms_map.get("en-IN")
    except Exception:
        return None


def _names_scheme(text: str, doc: Document) -> bool:
    """True when the answer mentions this scheme card by any of its names or its code."""
    names = [doc.metadata.get(k) for k in ("name_en", "name_hi", "name_mr", "name_ta", "code")]
    return any(n and len(str(n)) >= 3 and str(n).split(" (")[0] in text for n in names)


def _scheme_named_in(text: str, scored: List[Tuple[Document, float]]) -> Optional[Document]:
    """The single retrieved scheme card the answer names, else None (none or ambiguous)."""
    named = {str(d.metadata.get("code")): d for d, _ in scored if d.metadata.get("kind") == "scheme" and _names_scheme(text, d)}
    return next(iter(named.values())) if len(named) == 1 else None


def _cap_text_sentences(text: str, max_sentences: int = 5) -> str:
    """Text answers: at most 5 sentences; keep the first 4 and the last (it carries the helpline)."""
    sentences = [x for x in re.split(r"(?<=[.।!?])\s+", text.strip()) if x.strip()]
    if len(sentences) <= max_sentences:
        return text.strip()
    return " ".join(sentences[: max_sentences - 1] + sentences[-1:])


def _clean_for_voice(text: str, language: str) -> str:
    """Enforce for_voice rules from VOICE_INSTRUCTION: plain text, no URLs/markdown/lists, max 3 short sentences."""
    cleaned = text
    if "URLs" in VOICE_INSTRUCTION:
        cleaned = re.sub(r"https?://\S+", "", cleaned)
        cleaned = re.sub(r"\b[a-zA-Z0-9.-]+\.(?:gov|nic|org|ac)\.in(?:/\S*)?", "", cleaned)
    cleaned = re.sub(r"[*_`#>\[\]]+", "", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    sentences = [
        s.strip()
        for s in re.split(r"(?<=[.।!?])\s+", cleaned)
        if s.strip()
    ]
    if "3 short sentences" in VOICE_INSTRUCTION and len(sentences) > 3:
        sentences = sentences[:3]
    result = " ".join(sentences).strip()
    if not result:
        result = VOICE_CLOSING_BY_LANG.get(language, VOICE_CLOSING_BY_LANG["en-IN"])
    return result


def _extract_two_relevant_sentences(chunk_text: str, helpline: str, query: str = "") -> str:
    """
    Extract the two most relevant sentences from the top guide chunk plus the relevant helpline (RAG-05 item 3).
    """
    body = chunk_text.removeprefix("passage: ").strip()
    content_lines: List[str] = []
    for idx, ln in enumerate(body.splitlines()):
        stripped = ln.strip()
        if not stripped:
            continue
        # Skip the first header line ("Doc Title | ## Section...")
        if idx == 0 and ("|" in stripped or stripped.startswith("#")):
            continue
        if stripped.startswith("#"):
            continue
        if stripped.startswith("Context:"):
            continue
        cleaned_line = re.sub(r"^[-*•]\s+|\d+\.\s+", "", stripped).strip()
        if cleaned_line:
            content_lines.append(cleaned_line)

    combined = " ".join(content_lines)
    raw_sentences = [
        s.strip()
        for s in re.split(r"(?<=[.।!?])\s+", combined)
        if len(s.strip()) > 12
    ]
    if not raw_sentences:
        raw_sentences = [s.strip() for s in content_lines if s.strip()]

    query_tokens = {
        tok.lower()
        for tok in re.findall(r"\w+", query)
        if len(tok) > 2
    }

    if query_tokens and len(raw_sentences) > 2:
        scored_sentences = []
        for idx, sent in enumerate(raw_sentences):
            sent_tokens = {t.lower() for t in re.findall(r"\w+", sent)}
            overlap = len(query_tokens & sent_tokens)
            # Keep original order as tie-breaker
            scored_sentences.append((overlap, -idx, idx, sent))
        top_two = sorted(scored_sentences, reverse=True)[:2]
        top_two.sort(key=lambda item: item[2])
        chosen = [item[3] for item in top_two]
    else:
        chosen = raw_sentences[:2]

    selected = " ".join(
        s if s.endswith((".", "।", "!", "?")) else f"{s}."
        for s in chosen
    ).strip()

    if helpline and helpline not in selected:
        selected = f"{selected} Helpline: {helpline}." if selected else f"Helpline: {helpline}."
    return selected or body[:280]


def _build_extractive_answer(
    top_doc: Document,
    language: str,
    for_voice: bool,
    sms_summary: Optional[str],
    query: str = "",
) -> str:
    """
    Build a deterministic extractive answer when MOCK_LLM=true, LLM_API_KEY is missing,
    or Groq fails (RAG-05):
    - Scheme cards: localised name (name_hi / name_mr / name_ta / name_en) + card sms_summary in requested language + helpline.
    - Guide chunks: two most relevant sentences from the top chunk + relevant helpline (with regional script support for hi/mr/ta seed guides).
    """
    if not _is_prompt_intact():
        return f"Broken prompt configuration: {SYSTEM_PROMPT_TEMPLATE[:160]}"

    kind = top_doc.metadata.get("kind")
    helpline = str(top_doc.metadata.get("helpline") or "1800-180-1551")

    if kind == "scheme":
        lang_prefix = language.split("-")[0]
        local_name = str(
            top_doc.metadata.get(f"name_{lang_prefix}")
            or top_doc.metadata.get("name_en")
            or top_doc.metadata.get("title")
            or ""
        ).strip()

        raw_sms = top_doc.metadata.get("sms_summary")
        resolved_sms = sms_summary
        if not resolved_sms and raw_sms:
            try:
                sms_map = json.loads(raw_sms) if isinstance(raw_sms, str) else raw_sms
                resolved_sms = sms_map.get(language) or sms_map.get("en-IN")
            except Exception:
                resolved_sms = None

        if resolved_sms:
            if local_name and local_name not in resolved_sms:
                ans = f"{local_name}: {resolved_sms}"
            else:
                ans = resolved_sms
            if helpline and helpline not in ans:
                ans = f"{ans} Helpline: {helpline}"
        else:
            ans = _extract_two_relevant_sentences(top_doc.page_content, helpline, query=query)

        if for_voice:
            # Keep single-sentence flow before appending SMS closing so voice output stays <=3 sentences with helpline intact
            voice_base = re.sub(r"[.।]+\s*", ", ", ans.strip()).strip(", ")
            closing = VOICE_CLOSING_BY_LANG.get(language, VOICE_CLOSING_BY_LANG["en-IN"])
            return _clean_for_voice(f"{voice_base}. {closing}", language)
        return ans

    # Guide chunk: if language is regional (hi-IN, mr-IN, ta-IN) and matches a seed guide topic, return grounded regional summary
    heading_lower = str(top_doc.metadata.get("title") or top_doc.page_content[:200]).lower()
    if language != "en-IN":
        for topic_key, lang_map in GUIDE_LOCALISED_SUMMARIES:
            if topic_key in heading_lower and language in lang_map:
                ans = lang_map[language]
                if helpline and not any(h.strip() in ans for h in helpline.split("/")):
                    ans = f"{ans} ({helpline})"
                if for_voice:
                    closing = VOICE_CLOSING_BY_LANG.get(language, VOICE_CLOSING_BY_LANG["en-IN"])
                    return _clean_for_voice(f"{ans} {closing}", language)
                return ans

    # English or newly uploaded guide chunk: two most relevant sentences from top chunk + helpline
    ans = _extract_two_relevant_sentences(top_doc.page_content, helpline, query=query)
    if for_voice:
        return _clean_for_voice(ans, language)
    return ans


class RagEngine:
    """Singleton manager holding the loaded HuggingFace embedding model, ChromaDB collection, and query cache."""

    def __init__(self) -> None:
        self.embeddings: Optional[Any] = None
        self.chroma_client: Optional[chromadb.ClientAPI] = None
        self.vectorstore: Optional[Any] = None
        self.load_time_ms: int = 0
        self.ready: bool = False
        self._embed_ready = threading.Event()
        self._init_lock = threading.Lock()
        self.query_cache = QueryResponseCache(max_entries=200, ttl_seconds=600.0)

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
            # Not `ready` here: during server startup this runs mid-ingest; readiness is set by
            # _load_embedding_model after ingest + warm-up (RAG-07).
            if not self._embed_ready.is_set():
                self._load_embedding_model(t0, auto_ingest_if_empty=False)

    def initialize(self) -> None:
        """Open persistent ChromaDB collection immediately and load embedding model at startup.

        RAG-07: `ready` (GET /health status "ok") is set only after the model is loaded, the seed is
        ingested and a warm-up retrieval has run, so the first real query never pays the cold start.
        """
        with self._init_lock:
            t0 = time.perf_counter()
            self._open_chroma_client()
            if self._embed_ready.is_set():
                self.ready = True
                return

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

            self._warm_up()
            self.ready = True
            logger.info("RAG ready (cold start %d ms)", int((time.perf_counter() - t0) * 1000))
        except Exception as exc:
            logger.error("Failed to load embedding model '%s': %s", settings.EMBED_MODEL, exc)
            self._embed_ready.set()

    # One retrieval per demo language warms tokenizer, model and HNSW index (RAG-07).
    _WARM_UP_QUERIES = (
        "पीएम किसान योजना के लिए कौन पात्र है?",
        "कापसावर गुलाबी बोंडअळी आली आहे, काय करावे?",
        "ஜனனி சுரக்ஷா யோஜனா திட்டத்தில் எவ்வளவு பணம் கிடைக்கும்?",
        "How do I apply on the National Scholarship Portal?",
    )

    def _warm_up(self) -> None:
        t_warm = time.perf_counter()
        for q in self._WARM_UP_QUERIES:
            try:
                self.search_chunks_timed(q, category=None, k=3)
            except Exception as exc:  # warm-up must never block startup
                logger.warning("Warm-up query failed: %s", exc)
                return
        logger.info("Warm-up: %d retrievals in %d ms", len(self._WARM_UP_QUERIES), int((time.perf_counter() - t_warm) * 1000))

    def ensure_embeddings_ready(self, timeout: float = 30.0) -> None:
        if not self._embed_ready.is_set():
            self._embed_ready.wait(timeout=timeout)

    def sync_existing_raw_categories_to_manifest(self) -> None:
        """Preserve any existing source->category metadata from Chroma into raw_manifest.json before reset (CCR-06)."""
        if self.chroma_client is None:
            return
        try:
            collection = self.chroma_client.get_or_create_collection(
                name=settings.CHROMA_COLLECTION,
                metadata={"hnsw:space": "cosine"},
            )
            if collection.count() == 0:
                return
            existing = collection.get(include=["metadatas"])
            metadatas = existing.get("metadatas") or []
            from ingest import GUIDE_CATEGORY_MAP, record_raw_file_category

            seed_sources = set(GUIDE_CATEGORY_MAP.keys()) | {"schemes.json"}
            for meta in metadatas:
                if not isinstance(meta, dict):
                    continue
                src = str(meta.get("source") or "").strip()
                cat = str(meta.get("category") or "").strip()
                if src and src not in seed_sources and cat:
                    record_raw_file_category(settings.RAW_DIR / src, cat)
        except Exception as exc:
            logger.warning("Failed to snapshot existing raw categories from Chroma: %s", exc)

    def reset_collection(self) -> None:
        """Delete and recreate the Chroma collection and clear the query cache."""
        self.ensure_embeddings_ready()
        self.query_cache.clear()
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
        """Idempotently upsert (id, Document) pairs into Chroma and invalidate cache."""
        if not items:
            return 0
        self.ensure_embeddings_ready()
        assert self.vectorstore is not None

        ids = [doc_id for doc_id, _ in items]
        docs = [doc for _, doc in items]
        self.vectorstore.add_documents(documents=docs, ids=ids)
        self.query_cache.clear()
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

        from ingest import load_raw_file_documents, record_raw_file_category

        try:
            items = load_raw_file_documents(target_path, category=req.category)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        record_raw_file_category(target_path, req.category)
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

    @staticmethod
    def _select_primary_doc(scored: List[Tuple[Document, float]]) -> Tuple[Document, float]:
        """
        Return the primary (top_doc, top_sim), promoting a canonical scheme card if the #1 chunk
        is a guide section mirroring that exact scheme and the scheme card is also >= RAG_MATCH_THRESHOLD.
        """
        top_doc, top_sim = scored[0]
        if top_doc.metadata.get("kind") == "guide":
            top_title_upper = str(top_doc.metadata.get("title") or "").upper()
            for cand_doc, cand_sim in scored[1:]:
                if cand_doc.metadata.get("kind") == "scheme" and cand_sim >= settings.RAG_MATCH_THRESHOLD:
                    cand_code = str(cand_doc.metadata.get("code") or "").upper()
                    cand_title = str(cand_doc.metadata.get("name_en") or "").upper()
                    if (cand_code and cand_code in top_title_upper) or (cand_title and cand_title in top_title_upper):
                        return cand_doc, cand_sim
        return top_doc, top_sim

    def retrieve(self, req: RagQueryRequest) -> RagRetrieveResponse:
        """Return raw retrieved chunks and matched_scheme_id for POST /rag/retrieve."""
        top_k = 3 if req.for_voice else settings.RAG_TOP_K
        scored, _emb_ms, _ret_ms = self.search_chunks_timed(req.query, category=req.category, k=top_k)

        matched_scheme_id: Optional[str] = None
        if scored:
            top_doc, top_sim = self._select_primary_doc(scored)
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
        """Execute the LangChain retrieval-and-answer chain with cache and extractive fallback (RAG-03..RAG-05)."""
        t0 = time.perf_counter()

        # 1. Check in-process cache keyed by (query, language, category, for_voice) when no custom history is passed
        cache_key: CacheKey = (
            req.query.strip(),
            req.language,
            req.category or "",
            bool(req.for_voice),
        )
        if not req.history:
            cached = self.query_cache.get(cache_key)
            # Only serve an LLM-generated cached answer if we are still in 'llm' mode, or extractive if in 'extractive' mode
            if cached is not None and (
                cached.get("mode") == llm_state.current_mode or not llm_state.can_attempt_groq
            ):
                elapsed_ms = int((time.perf_counter() - t0) * 1000)
                return RagQueryResponse(
                    answer=cached["answer"],
                    sources=cached["sources"],
                    matched_scheme_id=cached["matched_scheme_id"],
                    sms_summary=cached["sms_summary"],
                    confidence=cached["confidence"],
                    mode="extractive" if not llm_state.can_attempt_groq else cached["mode"],
                    latency_ms=elapsed_ms,
                )

        # 2. Check safety, dose refusal, prompt-injection, and explicit out-of-scope overrides (RAG-04)
        safety_override = check_safety_override(
            req.query,
            req.language,
            req.category,
            for_voice=req.for_voice,
        )
        if safety_override is not None:
            elapsed_ms = int((time.perf_counter() - t0) * 1000)
            mode_out = "extractive" if not llm_state.can_attempt_groq else safety_override.get("mode", llm_state.current_mode)
            ans_out = safety_override["answer"]
            if req.for_voice:
                ans_out = _clean_for_voice(ans_out, req.language)
            resp = RagQueryResponse(
                answer=ans_out,
                sources=safety_override.get("sources", []),
                matched_scheme_id=safety_override.get("matched_scheme_id"),
                sms_summary=safety_override.get("sms_summary"),
                confidence=safety_override.get("confidence", 1.0),
                mode=mode_out,
                latency_ms=elapsed_ms,
            )
            if not req.history:
                self.query_cache.set(cache_key, resp.model_dump())
            return resp

        # 3. Embed + Retrieve from Chroma. The LLM picks the block that really answers (DEC-20), so voice
        # gets the same top-k as text: with 3 near-equal scores the right chunk was often missing.
        top_k = settings.RAG_TOP_K
        scored, embed_ms, retrieve_ms = self.search_chunks_timed(
            req.query,
            category=req.category,
            k=top_k,
        )

        if req.category:
            # The chosen category (IVR digit / web chip) is a hint, not a wall: a crop question asked under
            # "schemes" must still reach the agriculture guide. Merge the best unfiltered hits.
            unfiltered_scored, emb2_ms, ret2_ms = self.search_chunks_timed(
                req.query,
                category=None,
                k=top_k,
            )
            embed_ms += emb2_ms
            retrieve_ms += ret2_ms
            if not scored or (unfiltered_scored and unfiltered_scored[0][1] > scored[0][1] + 0.02):
                scored = unfiltered_scored
            else:
                seen = {id(d) for d, _ in scored}
                keys = {d.page_content for d, _ in scored}
                extra = [(d, sim) for d, sim in unfiltered_scored if id(d) not in seen and d.page_content not in keys]
                scored = sorted(scored + extra[:2], key=lambda pair: pair[1], reverse=True)

        if not scored:
            oos = build_out_of_scope_override(req.language, for_voice=req.for_voice)
            elapsed_ms = int((time.perf_counter() - t0) * 1000)
            return RagQueryResponse(
                answer=oos["answer"],
                sources=[],
                matched_scheme_id=None,
                sms_summary=None,
                confidence=0.0,
                mode=llm_state.current_mode,
                latency_ms=elapsed_ms,
            )

        top_doc, top_sim = self._select_primary_doc(scored)

        has_guide_match = any(
            doc.metadata.get("kind") == "guide" and sim >= (settings.RAG_MATCH_THRESHOLD - 0.015)
            for doc, sim in scored
        )
        if top_sim < (settings.RAG_MATCH_THRESHOLD - 0.15) or (
            top_sim < settings.RAG_MATCH_THRESHOLD and not has_guide_match
        ):
            oos = build_out_of_scope_override(req.language, for_voice=req.for_voice)
            elapsed_ms = int((time.perf_counter() - t0) * 1000)
            resp = RagQueryResponse(
                answer=oos["answer"],
                sources=[],
                matched_scheme_id=None,
                sms_summary=None,
                confidence=top_sim,
                mode=llm_state.current_mode,
                latency_ms=elapsed_ms,
            )
            if not req.history:
                self.query_cache.set(cache_key, resp.model_dump())
            return resp

        matched_scheme_id: Optional[str] = None
        sms_summary: Optional[str] = None

        if top_doc.metadata.get("kind") == "scheme" and top_sim >= settings.RAG_MATCH_THRESHOLD:
            matched_scheme_id = str(top_doc.metadata.get("code") or top_doc.metadata.get("id"))
            sms_summary = _sms_summary_of(top_doc, req.language)

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
            clean_chunk = sanitize_retrieved_context(doc.page_content.removeprefix("passage: ").strip())
            context_blocks.append(f"[{idx}] ({src_id}, score={sim:.3f}):\n{clean_chunk}")

        llm_blocks = context_blocks[: settings.LLM_CONTEXT_CHUNKS] if settings.LLM_CONTEXT_CHUNKS > 0 else context_blocks
        # Groq free tier = 8,000 tokens/min per model: cap each block so one question stays ~1,200 tokens.
        llm_blocks = [b if len(b) <= _LLM_BLOCK_CHARS else b[:_LLM_BLOCK_CHARS].rsplit(" ", 1)[0] + " ..." for b in llm_blocks]
        context_str = "\n\n".join(llm_blocks)
        llm_ms = 0.0

        # 4. Run Groq LCEL chain if available (and >=60s since any prior failure), else extractive fallback (RAG-05)
        if llm_state.can_attempt_groq:
            t_llm0 = time.perf_counter()
            try:
                answer_text, chosen_source, parsed = parse_answer_json(invoke_lcel_answer(
                    question=req.query,
                    context=context_str,
                    language=req.language,
                    role=req.role,
                    for_voice=req.for_voice,
                    history=req.history,
                ))
                if parsed:
                    # The scheme (and its SMS receipt) is the one the answer is based on; a guide-based or
                    # general answer gets no scheme card, never a neighbouring one (DEC-20).
                    # The model may name the block by id ("KCC") or by its number ("2" / "[2]").
                    ref = (chosen_source or "").strip()
                    ids = [str(d.metadata.get("code") or d.metadata.get("id")) for d, _ in scored]
                    named_id = next((i for i in sorted(set(ids), key=len, reverse=True) if re.search(rf"(?<![A-Z_]){re.escape(i)}(?![A-Z_0-9])", ref)), None)
                    number = re.match(r"\[?(\d+)\]?", ref)
                    if named_id:  # "JSY", "(JSY, score=...)", "1 (JSY)"
                        chosen = scored[ids.index(named_id)][0]
                    elif number and 1 <= int(number.group(1)) <= len(scored):  # "2", "[2]"
                        chosen = scored[int(number.group(1)) - 1][0]
                    else:
                        chosen = None
                    chosen_source = str(chosen.metadata.get("code") or chosen.metadata.get("id")) if chosen is not None else None
                    chosen_sim = next((sim for d, sim in scored if d is chosen), 0.0)
                    if chosen is None:
                        # The model used no block ("no verified information"): never attach a card or receipt.
                        matched_scheme_id = None
                        sms_summary = None
                    elif chosen.metadata.get("kind") == "scheme" and chosen_sim < settings.RAG_MATCH_THRESHOLD:
                        # Same bar as before DEC-20: a weakly related card (state scheme we do not hold) is no match.
                        matched_scheme_id = None
                        sms_summary = None
                    elif chosen.metadata.get("kind") == "scheme":
                        # Cross-check the citation: an answer about "Kisan Credit Card" that cites the PMFBY
                        # block (wrong number) gets the card it actually names (seen live, DEC-20).
                        named_doc = _scheme_named_in(answer_text, scored)
                        if named_doc is not None and not _names_scheme(answer_text, chosen):
                            chosen = named_doc
                            chosen_source = str(chosen.metadata.get("code") or chosen.metadata.get("id"))
                        matched_scheme_id = chosen_source
                        sms_summary = _sms_summary_of(chosen, req.language)
                    elif matched_scheme_id and chosen.metadata.get("category") != top_doc.metadata.get("category"):
                        # A guide from another topic (crop question vs a health card ranked first): no scheme card.
                        matched_scheme_id = None
                        sms_summary = None
                    # A guide section of the same topic mirrors the card (NSP section <-> NSP card): keep the match.
                    if chosen is not None:
                        sources.sort(key=lambda src: src.id != chosen_source)
                # The model sometimes echoes its citation ("(GUIDE_AGRI_1)", "[2]") into the answer.
                answer_text = _SOURCE_REF_RE.sub("", answer_text).strip()
                if req.for_voice:
                    answer_text = _clean_for_voice(answer_text, req.language)
                else:
                    answer_text = _cap_text_sentences(answer_text)
                mode_used = "llm"
            except Exception as exc:
                logger.warning("Groq LCEL call failed (%s); falling back to extractive answer for 60s.", exc)
                llm_state.record_failure()
                mode_used = "extractive"
                answer_text = _build_extractive_answer(
                    top_doc=top_doc,
                    language=req.language,
                    for_voice=req.for_voice,
                    sms_summary=sms_summary,
                    query=req.query,
                )
            llm_ms = (time.perf_counter() - t_llm0) * 1000.0
        else:
            mode_used = "extractive"
            answer_text = _build_extractive_answer(
                top_doc=top_doc,
                language=req.language,
                for_voice=req.for_voice,
                sms_summary=sms_summary,
                query=req.query,
            )

        # A scheme answer always carries its helpline (the model sometimes drops it).
        if matched_scheme_id:
            card_doc = next((d for d, _ in scored if str(d.metadata.get("code") or d.metadata.get("id")) == matched_scheme_id), None)
            helpline = str(card_doc.metadata.get("helpline") or "") if card_doc is not None else ""
            first = helpline.split("/")[0].strip()
            if first and first not in answer_text:
                # Joined to the last sentence so a spoken answer stays within its 3 sentences.
                body = answer_text.rstrip().rstrip(".।!?")
                end = "।" if req.language in ("hi-IN", "mr-IN") else "."
                answer_text = f"{body}, {_HELPLINE_WORD.get(req.language, 'Helpline')}: {first}{end}"

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

        resp = RagQueryResponse(
            answer=answer_text,
            sources=sources,
            matched_scheme_id=matched_scheme_id,
            sms_summary=sms_summary,
            confidence=top_sim,
            mode=mode_used,
            latency_ms=elapsed_ms,
        )
        if not req.history:
            self.query_cache.set(cache_key, resp.model_dump())
        return resp


rag_engine = RagEngine()
