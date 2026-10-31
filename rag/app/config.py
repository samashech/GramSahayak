import os
from pathlib import Path
from dotenv import load_dotenv

RAG_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = RAG_DIR.parent

# Disable ChromaDB telemetry noise
os.environ.setdefault("ANONYMIZED_TELEMETRY", "False")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

# Load root .env first, then optional local rag/.env fallback
load_dotenv(REPO_ROOT / ".env", override=False)
load_dotenv(RAG_DIR / ".env", override=False)


def _parse_bool(val: str | None, default: bool = False) -> bool:
    if val is None:
        return default
    return val.strip().lower() in {"1", "true", "yes", "on"}


def _resolve_chroma_dir(raw_dir: str) -> Path:
    path = Path(raw_dir)
    if path.is_absolute():
        return path
    # Support running from either repo root or /rag directory seamlessly
    if raw_dir.startswith("rag/"):
        return (REPO_ROOT / raw_dir).resolve()
    return (RAG_DIR / raw_dir).resolve()


class Settings:
    """Configuration loaded from root .env with Contract v1 section 10 defaults."""

    def __init__(self) -> None:
        self.APP_ENV: str = os.getenv("APP_ENV", "development")
        self.PORT: int = int(os.getenv("RAG_PORT", "8000"))

        # LLM / Groq settings
        self.LLM_API_KEY: str = os.getenv("LLM_API_KEY", "").strip()
        self.LLM_MODEL: str = os.getenv("LLM_MODEL", "llama-3.3-70b-versatile").strip()
        self.MOCK_LLM: bool = _parse_bool(os.getenv("MOCK_LLM"), default=False)
        self.LLM_TIMEOUT_SEC: float = float(os.getenv("LLM_TIMEOUT_SEC", "3.5"))
        # Output budgets (Tamil needs more tokens per sentence than Hindi/English) and, for reasoning
        # models on Groq, the reasoning effort ("none" for qwen3, "low" for gpt-oss; empty = not sent).
        self.LLM_MAX_TOKENS_VOICE: int = int(os.getenv("LLM_MAX_TOKENS_VOICE", "120"))
        self.LLM_MAX_TOKENS_TEXT: int = int(os.getenv("LLM_MAX_TOKENS_TEXT", "220"))
        self.LLM_REASONING_EFFORT: str = os.getenv("LLM_REASONING_EFFORT", "").strip()
        # Chunks sent to the LLM (0 = all retrieved). Fewer chunks = fewer tokens per minute on Groq's free tier.
        self.LLM_CONTEXT_CHUNKS: int = int(os.getenv("LLM_CONTEXT_CHUNKS", "0"))
        # Tried in order when the primary model is rate-limited (429); each Groq model has its own TPM budget.
        self.LLM_FALLBACK_MODELS: list[str] = [m.strip() for m in os.getenv("LLM_FALLBACK_MODELS", "").split(",") if m.strip()]
        self.LLM_TEMPERATURE: float = float(os.getenv("LLM_TEMPERATURE", "0.2"))

        # Embedding & Chroma settings
        self.EMBED_MODEL: str = os.getenv(
            "EMBED_MODEL", "intfloat/multilingual-e5-small"
        ).strip()
        self.CHROMA_DIR_RAW: str = os.getenv("CHROMA_DIR", "rag/chroma_db").strip()
        self.CHROMA_DIR: Path = _resolve_chroma_dir(self.CHROMA_DIR_RAW)
        self.CHROMA_COLLECTION: str = os.getenv(
            "CHROMA_COLLECTION", "gramsahayak_knowledge"
        ).strip()

        # Retrieval parameters
        self.RAG_TOP_K: int = int(os.getenv("RAG_TOP_K", "4"))
        self.RAG_MATCH_THRESHOLD: float = float(
            os.getenv("RAG_MATCH_THRESHOLD", "0.80")
        )
        self.TRANSLATE_PIVOT: bool = _parse_bool(
            os.getenv("TRANSLATE_PIVOT"), default=False
        )

        # Paths
        self.REPO_ROOT: Path = REPO_ROOT
        self.RAG_DIR: Path = RAG_DIR
        self.SEED_DIR: Path = REPO_ROOT / "data" / "seed"
        self.RAW_DIR: Path = REPO_ROOT / "data" / "raw"

        # CORS allowed origins (localhost + any FRONTEND_ORIGIN entries)
        frontend_origins = [
            o.strip()
            for o in os.getenv("FRONTEND_ORIGIN", "http://localhost:3000").split(",")
            if o.strip()
        ]
        default_local_origins = [
            "http://localhost:3000",
            "http://localhost:5000",
            "http://localhost:8000",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:5000",
            "http://127.0.0.1:8000",
        ]
        self.CORS_ORIGINS: list[str] = list(
            dict.fromkeys(default_local_origins + frontend_origins)
        )

    @property
    def effective_mode(self) -> str:
        """Return 'extractive' if MOCK_LLM is set or LLM_API_KEY is missing, else 'llm'."""
        if self.MOCK_LLM or not self.LLM_API_KEY:
            return "extractive"
        return "llm"


settings = Settings()
