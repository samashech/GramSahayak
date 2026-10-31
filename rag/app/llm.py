"""Groq LLM client wrapper, LCEL chain builder, and 60s retry state tracker for GramSahayak RAG (RAG-03 & RAG-05)."""

import logging
import re
import time
from typing import List, Literal, Sequence

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnableSerializable
from langchain_groq import ChatGroq

from app.config import settings
from app.prompts import (
    LANGUAGE_NAMES,
    ROLE_HINTS,
    TEXT_INSTRUCTION,
    VOICE_INSTRUCTION,
    build_rag_prompt,
)
from app.schemas import HistoryMessage

logger = logging.getLogger("gramsahayak.llm")


class LLMRuntimeState:
    """
    Tracks whether the service is operating in 'llm' or 'extractive' mode (RAG-05).
    - When MOCK_LLM=true or LLM_API_KEY is missing -> 'extractive'.
    - When Groq fails (timeout, 429, 5xx, error) -> 'extractive' for 60 seconds, then retries Groq.
    - /health reports 'llm' when the last Groq call succeeded (or key is present and no recent failure),
      'extractive' otherwise.
    """

    def __init__(self, retry_interval_sec: float = 60.0) -> None:
        self._last_failure_ts: float = 0.0
        self._last_success_ts: float = 0.0
        self._retry_interval_sec: float = retry_interval_sec

    @property
    def can_attempt_groq(self) -> bool:
        """Return True if Groq should be attempted on the next query (initial attempt or >=60s since failure)."""
        if settings.MOCK_LLM or not settings.LLM_API_KEY:
            return False
        if self._last_failure_ts == 0.0:
            return True
        return (time.time() - self._last_failure_ts) >= self._retry_interval_sec

    @property
    def current_mode(self) -> Literal["llm", "extractive"]:
        """
        Report current mode for /health and responses:
        - 'extractive' if MOCK_LLM=true, LLM_API_KEY is unset, or the last Groq call failed within 60s.
        - 'llm' when LLM_API_KEY is configured, MOCK_LLM=false, and the last Groq call succeeded (or no failure occurred).
        """
        if settings.MOCK_LLM or not settings.LLM_API_KEY:
            return "extractive"
        if self._last_failure_ts > 0.0 and (time.time() - self._last_failure_ts) < self._retry_interval_sec:
            return "extractive"
        return "llm"

    def record_success(self) -> None:
        self._last_failure_ts = 0.0
        self._last_success_ts = time.time()

    def record_failure(self) -> None:
        self._last_failure_ts = time.time()


llm_state = LLMRuntimeState(retry_interval_sec=60.0)


def _reasoning_effort(model: str) -> str:
    """Groq reasoning models need the right effort value: qwen3 'none', gpt-oss 'low'."""
    if model == settings.LLM_MODEL and settings.LLM_REASONING_EFFORT:
        return settings.LLM_REASONING_EFFORT
    if model.startswith("openai/gpt-oss"):
        return "low"
    if model.startswith("qwen/qwen3"):
        return "none"
    return ""


def get_chat_groq(for_voice: bool = False, model: str | None = None) -> ChatGroq:
    """Build a configured ChatGroq instance per contract budget rules (temperature 0.2, timeout 3.5s)."""
    model = model or settings.LLM_MODEL
    max_tokens = settings.LLM_MAX_TOKENS_VOICE if for_voice else settings.LLM_MAX_TOKENS_TEXT
    effort = _reasoning_effort(model)
    extra = {"reasoning_effort": effort} if effort else {}
    return ChatGroq(
        api_key=settings.LLM_API_KEY,
        model=model,
        temperature=settings.LLM_TEMPERATURE,
        max_tokens=max_tokens,
        timeout=settings.LLM_TIMEOUT_SEC,
        max_retries=0,
        model_kwargs=extra,
    )


def build_lcel_chain(for_voice: bool = False, model: str | None = None) -> RunnableSerializable[dict, str]:
    """Build the LangChain Expression Language (LCEL) chain: prompt | llm | parser."""
    prompt = build_rag_prompt()
    llm = get_chat_groq(for_voice=for_voice, model=model)
    parser = StrOutputParser()
    return prompt | llm | parser


def trim_history_messages(
    history: Sequence[HistoryMessage],
    max_messages: int = 6,
    max_chars: int = 1200,
) -> List[BaseMessage]:
    """Keep the last 6 messages from the request, trimmed to at most 1200 total characters."""
    recent = list(history[-max_messages:])
    trimmed_reversed: List[BaseMessage] = []
    used_chars = 0

    for item in reversed(recent):
        text = item.content.strip()
        if not text:
            continue
        remaining = max_chars - used_chars
        if remaining <= 0:
            break
        if len(text) > remaining:
            text = text[-remaining:]
        used_chars += len(text)
        if item.role == "user":
            trimmed_reversed.append(HumanMessage(content=text))
        else:
            trimmed_reversed.append(AIMessage(content=text))

    return list(reversed(trimmed_reversed))


def invoke_lcel_answer(
    *,
    question: str,
    context: str,
    language: str,
    role: str,
    for_voice: bool,
    history: Sequence[HistoryMessage],
) -> str:
    """Invoke the LCEL (prompt | llm | parser) chain with Groq and update runtime state."""
    language_name = LANGUAGE_NAMES.get(language, "Hindi")
    role_hint = ROLE_HINTS.get(role, ROLE_HINTS["farmer"])
    format_instruction = (
        VOICE_INSTRUCTION
        if for_voice
        else TEXT_INSTRUCTION.format(language_name=language_name, language=language)
    )
    lc_history = trim_history_messages(history, max_messages=6, max_chars=1200)

    inputs = {
            "language_name": language_name,
            "language": language,
            "role": role,
            "role_hint": role_hint,
            "format_instruction": format_instruction,
            "context": context,
            "history": lc_history,
            "question": question,
    }
    models = [settings.LLM_MODEL, *settings.LLM_FALLBACK_MODELS]
    for i, model in enumerate(models):
        try:
            answer = build_lcel_chain(for_voice=for_voice, model=model).invoke(inputs)
            break
        except Exception as exc:  # only a rate limit moves on to the next model's TPM budget
            if "429" not in str(exc) or i == len(models) - 1:
                raise
            logger.warning("Groq model %s rate-limited; trying %s", model, models[i + 1])
    llm_state.record_success()
    # Reasoning models may prefix hidden thinking; never pass it on.
    answer = re.sub(r"<think>.*?</think>", "", answer, flags=re.S)
    return answer.strip()
