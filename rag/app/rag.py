"""Core embedding, Chroma vector store, and query/ingest orchestration for GramSahayak RAG."""

import logging
import os
import threading
import time
from typing import Any, Optional

import chromadb
from chromadb.config import Settings as ChromaSettings
from huggingface_hub import try_to_load_from_cache

from app.config import settings
from app.llm import llm_state
from app.schemas import (
    RagIngestRequest,
    RagIngestResponse,
    RagQueryRequest,
    RagQueryResponse,
)

logger = logging.getLogger("gramsahayak.rag")

# Silence broken posthog telemetry in chromadb 0.6.x
try:
    import posthog

    posthog.disabled = True
    posthog.capture = lambda *args, **kwargs: None  # type: ignore[assignment]
except Exception:
    pass


class RagEngine:
    """Singleton manager holding the loaded HuggingFace embedding model and ChromaDB collection."""

    def __init__(self) -> None:
        self.embeddings: Optional[Any] = None
        self.chroma_client: Optional[chromadb.ClientAPI] = None
        self.vectorstore: Optional[Any] = None
        self.load_time_ms: int = 0
        self.ready: bool = False
        self._embed_ready = threading.Event()

    def initialize(self) -> None:
        """Open persistent ChromaDB collection immediately and load the embedding model once at startup."""
        t0 = time.perf_counter()
        settings.CHROMA_DIR.mkdir(parents=True, exist_ok=True)
        self.chroma_client = chromadb.PersistentClient(
            path=str(settings.CHROMA_DIR),
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        self.chroma_client.get_or_create_collection(
            name=settings.CHROMA_COLLECTION,
            metadata={"hnsw:space": "cosine"},
        )
        self.ready = True

        # Load embedding model in background thread at startup and wait up to 2.5s so /health responds <5s
        loader_thread = threading.Thread(target=self._load_embedding_model, args=(t0,), daemon=True)
        loader_thread.start()
        loader_thread.join(timeout=2.5)

    def _load_embedding_model(self, t0: float) -> None:
        try:
            logger.info("Loading embedding model '%s'...", settings.EMBED_MODEL)
            cached_cfg = try_to_load_from_cache(settings.EMBED_MODEL, "config.json")
            use_local_only = isinstance(cached_cfg, str)
            if use_local_only:
                os.environ.setdefault("HF_HUB_OFFLINE", "1")
                os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")

            from langchain_chroma import Chroma
            from langchain_huggingface import HuggingFaceEmbeddings

            self.embeddings = HuggingFaceEmbeddings(
                model_name=settings.EMBED_MODEL,
                model_kwargs={"device": "cpu", "local_files_only": use_local_only},
                encode_kwargs={"normalize_embeddings": True},
            )
            self.vectorstore = Chroma(
                client=self.chroma_client,
                collection_name=settings.CHROMA_COLLECTION,
                embedding_function=self.embeddings,
                collection_metadata={"hnsw:space": "cosine"},
            )
            self.embeddings.embed_query("query: PM Kisan")
            self.load_time_ms = int((time.perf_counter() - t0) * 1000)
            self._embed_ready.set()
            logger.info(
                "Embedding model '%s' and Chroma initialized in %d ms (vector_count=%d, chroma_dir=%s)",
                settings.EMBED_MODEL,
                self.load_time_ms,
                self.get_vector_count(),
                settings.CHROMA_DIR,
            )
        except Exception as exc:
            logger.error("Failed to load embedding model '%s': %s", settings.EMBED_MODEL, exc)
            self._embed_ready.set()

    def ensure_embeddings_ready(self, timeout: float = 30.0) -> None:
        if not self._embed_ready.is_set():
            self._embed_ready.wait(timeout=timeout)

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

    def query(self, req: RagQueryRequest) -> RagQueryResponse:
        """Execute RAG query (skeleton fallback until RAG-03 wires full retrieval chain)."""
        t0 = time.perf_counter()
        self.ensure_embeddings_ready()
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

    def ingest_file(self, req: RagIngestRequest) -> RagIngestResponse:
        """Skeleton ingest handler (implemented in RAG-02)."""
        self.ensure_embeddings_ready()
        return RagIngestResponse(
            ingested_chunks=0,
            vector_count=self.get_vector_count(),
        )


rag_engine = RagEngine()
