import logging
import time
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.llm import llm_state
from app.rag import rag_engine
from app.schemas import (
    HealthResponse,
    RagIngestRequest,
    RagIngestResponse,
    RagQueryRequest,
    RagQueryResponse,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("gramsahayak.api")


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Load the embedding model and Chroma collection once at startup and log the load time."""
    rag_engine.initialize()
    yield


app = FastAPI(
    title="GramSahayak RAG Service",
    version="1.0.0",
    description="Stateless multilingual grounded RAG engine (:8000) for GramSahayak (Contract v1 section 9).",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests_with_timing(request: Request, call_next):
    t0 = time.perf_counter()
    try:
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        logger.info(
            "%s %s -> %d (%.1f ms)",
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
        )
        return response
    except Exception as exc:
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        logger.error(
            "%s %s -> 500 unhandled error after %.1f ms: %s",
            request.method,
            request.url.path,
            elapsed_ms,
            exc,
        )
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal RAG service error."},
        )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
    """Return 422 with a clear human-readable message on invalid JSON or schema mismatch (never a stack trace)."""
    messages: list[str] = []
    for err in exc.errors():
        loc = ".".join(str(part) for part in err.get("loc", []) if part != "body")
        msg = err.get("msg", "Invalid value")
        messages.append(f"{loc}: {msg}" if loc else msg)
    detail_str = "; ".join(messages) if messages else "Invalid request payload"
    return JSONResponse(status_code=422, content={"detail": detail_str})


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": str(exc.detail)},
    )


@app.exception_handler(Exception)
async def global_exception_handler(_request: Request, exc: Exception) -> JSONResponse:
    """Global exception handler returning {"detail": "..."} without leaking stack traces."""
    logger.error("Unhandled exception: %s", exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal RAG service error."},
    )


@app.get("/health", response_model=HealthResponse)
async def get_health() -> HealthResponse:
    return HealthResponse(
        status="ok" if rag_engine.ready else "degraded",
        vector_count=rag_engine.get_vector_count(),
        embedding_model=settings.EMBED_MODEL,
        mode=llm_state.current_mode,
    )


@app.post("/rag/query", response_model=RagQueryResponse)
async def post_rag_query(payload: RagQueryRequest) -> RagQueryResponse:
    return rag_engine.query(payload)


@app.post("/rag/ingest", response_model=RagIngestResponse)
async def post_rag_ingest(payload: RagIngestRequest) -> RagIngestResponse:
    return rag_engine.ingest_file(payload)
