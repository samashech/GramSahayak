"""Safety guardrails and out-of-scope / prompt-injection checks (expanded in RAG-04)."""

from typing import Optional

EMERGENCY_HELPLINES = ["108", "102"]
AGRI_HELPLINE = "1800-180-1551"
HEALTH_HELPLINE = "104"


def check_safety_override(query: str, language: str, category: Optional[str] = None) -> Optional[dict]:
    """Placeholder hook for RAG-04 safety checks. Returns None when no override applies."""
    return None
