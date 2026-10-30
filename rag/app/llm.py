"""Groq LLM client wrapper and mode tracker for GramSahayak RAG (expanded in RAG-03 & RAG-05)."""

import time
from typing import Literal
from langchain_groq import ChatGroq
from app.config import settings


class LLMRuntimeState:
    """Tracks whether the service is operating in 'llm' or 'extractive' mode."""

    def __init__(self) -> None:
        self._last_failure_ts: float = 0.0
        self._retry_interval_sec: float = 60.0

    @property
    def current_mode(self) -> Literal["llm", "extractive"]:
        if settings.MOCK_LLM or not settings.LLM_API_KEY:
            return "extractive"
        if self._last_failure_ts > 0 and (time.time() - self._last_failure_ts) < self._retry_interval_sec:
            return "extractive"
        return "llm"

    def record_success(self) -> None:
        self._last_failure_ts = 0.0

    def record_failure(self) -> None:
        self._last_failure_ts = time.time()


llm_state = LLMRuntimeState()


def get_chat_groq(for_voice: bool = False) -> ChatGroq:
    """Build a configured ChatGroq instance per contract budget rules."""
    max_tokens = 120 if for_voice else 220
    return ChatGroq(
        api_key=settings.LLM_API_KEY,
        model=settings.LLM_MODEL,
        temperature=settings.LLM_TEMPERATURE,
        max_tokens=max_tokens,
        timeout=settings.LLM_TIMEOUT_SEC,
        max_retries=0,
    )
