"""Security middleware — PII scrubber placeholder (Module D)."""
from __future__ import annotations

import re
from typing import Any

# Simple regex-based PII patterns (placeholder — will be enhanced in Step 6)
_EMAIL_RE = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")
_PHONE_RE = re.compile(r"\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b")
_SSN_RE = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")


def scrub_pii(text: str) -> str:
    """Remove common PII patterns from text."""
    text = _EMAIL_RE.sub("[EMAIL_REDACTED]", text)
    text = _PHONE_RE.sub("[PHONE_REDACTED]", text)
    text = _SSN_RE.sub("[SSN_REDACTED]", text)
    return text
