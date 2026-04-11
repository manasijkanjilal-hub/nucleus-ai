"""LangGraph shared state definitions — placeholder for Step 3."""
from __future__ import annotations
from typing import Any
from pydantic import BaseModel, Field


class AgentState(BaseModel):
    """Shared state flowing through the multi-agent graph."""
    brand_id: str = ""
    campaign_id: str | None = None
    user_query: str = ""
    plan: list[str] = Field(default_factory=list)
    drafts: list[dict[str, Any]] = Field(default_factory=list)
    review_notes: list[str] = Field(default_factory=list)
    final_output: str = ""
    iteration: int = 0
