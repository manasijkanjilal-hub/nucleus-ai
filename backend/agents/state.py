"""LangGraph shared state definitions for the multi-agent workflow.

Uses TypedDict (required by LangGraph StateGraph) to define the shared
state that flows through Planner → Writer → Reviewer nodes.
"""
from __future__ import annotations

from typing import Any, TypedDict


class AgentState(TypedDict, total=False):
    """Shared state flowing through the multi-agent graph.

    Fields
    ------
    messages : list[dict]
        Conversation history (role / content dicts).
    brand_context : list[dict]
        Retrieved brand information from the Context Vault.
    current_draft : str
        The latest content draft produced by the Writer.
    feedback : str
        Reviewer feedback on the current draft.
    task_plan : list[dict]
        Structured sub-task breakdown from the Planner.
    brand_id : str
        Identifier used to query the correct brand context.
    iteration_count : int
        Tracks revision cycles to prevent infinite loops.
    user_prompt : str
        Original user request.
    final_approved : bool
        Whether the Reviewer approved the draft.
    error : str | None
        Error message if something went wrong.
    """

    messages: list[dict[str, Any]]
    brand_context: list[dict[str, Any]]
    current_draft: str
    feedback: str
    task_plan: list[dict[str, Any]]
    brand_id: str
    iteration_count: int
    user_prompt: str
    final_approved: bool
    error: str | None
