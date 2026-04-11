"""Multi-agent LangGraph workflow for the Agentic Workflow Engine (Module B).

Graph structure:

    ┌──────────┐     ┌──────────┐     ┌──────────┐
    │ Planner  │ ──▶ │  Writer  │ ──▶ │ Reviewer │
    └──────────┘     └──────────┘     └──────────┘
                          ▲                 │
                          │   (revise)      │
                          └─────────────────┘
                                            │ (approve)
                                            ▼
                                          END
"""
from __future__ import annotations

import logging
from typing import Any

from langgraph.graph import END, StateGraph

from agents.state import AgentState
from agents.nodes import planner_node, writer_node, reviewer_node

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Routing logic
# ---------------------------------------------------------------------------
def _should_revise(state: AgentState) -> str:
    """Conditional edge: route from Reviewer → Writer (revise) or END (approve)."""
    if state.get("final_approved", False):
        logger.info("[Router] Draft approved — ending workflow.")
        return "end"
    logger.info("[Router] Draft needs revision — routing back to writer.")
    return "revise"


# ---------------------------------------------------------------------------
# Build the graph
# ---------------------------------------------------------------------------
def build_workflow_graph() -> StateGraph:
    """Construct and compile the multi-agent StateGraph."""
    graph = StateGraph(AgentState)

    # --- Add nodes ---
    graph.add_node("planner", planner_node)
    graph.add_node("writer", writer_node)
    graph.add_node("reviewer", reviewer_node)

    # --- Edges ---
    graph.set_entry_point("planner")
    graph.add_edge("planner", "writer")
    graph.add_edge("writer", "reviewer")

    # Conditional: reviewer decides to approve (END) or revise (writer)
    graph.add_conditional_edges(
        "reviewer",
        _should_revise,
        {
            "revise": "writer",
            "end": END,
        },
    )

    return graph.compile()


# Module-level compiled graph (singleton)
workflow_app = build_workflow_graph()


# ---------------------------------------------------------------------------
# Convenience runner
# ---------------------------------------------------------------------------
def run_workflow(
    user_prompt: str,
    brand_id: str,
) -> dict[str, Any]:
    """Execute the full multi-agent workflow synchronously.

    Returns the final state dict with:
      - task_plan, current_draft, feedback, final_approved, messages, etc.
    """
    initial_state: AgentState = {
        "messages": [{"role": "user", "content": user_prompt}],
        "brand_context": [],
        "current_draft": "",
        "feedback": "",
        "task_plan": [],
        "brand_id": brand_id,
        "iteration_count": 0,
        "user_prompt": user_prompt,
        "final_approved": False,
        "error": None,
    }

    logger.info("Starting workflow for brand_id=%s, prompt='%s'", brand_id, user_prompt[:80])

    try:
        final_state = workflow_app.invoke(initial_state)
        logger.info("Workflow completed. Approved: %s", final_state.get("final_approved"))
        return dict(final_state)
    except Exception as exc:
        logger.error("Workflow execution failed: %s", exc, exc_info=True)
        return {
            **initial_state,
            "error": str(exc),
        }
