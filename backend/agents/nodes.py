"""Agent nodes for the multi-agent workflow graph.

Three nodes:
  1. **Planner**  — decomposes the user prompt into sub-tasks.
  2. **Writer**   — retrieves brand context and generates marketing assets.
  3. **Reviewer** — validates output against brand-safety & formatting rules.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from core.config import get_settings
from agents.state import AgentState
from agents.tools import retrieve_brand_context

logger = logging.getLogger(__name__)
settings = get_settings()

MAX_ITERATIONS = 3  # hard cap on revision cycles


# ---------------------------------------------------------------------------
# LLM helper
# ---------------------------------------------------------------------------
def _call_llm(system_prompt: str, user_prompt: str, temperature: float = 0.7) -> str:
    """Call OpenAI chat completion (sync)."""
    if not settings.OPENAI_API_KEY:
        logger.warning("No OPENAI_API_KEY — returning mock LLM response.")
        return _mock_llm_response(system_prompt, user_prompt)

    from openai import OpenAI

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    response = client.chat.completions.create(
        model=settings.LLM_MODEL,
        temperature=temperature,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )
    return response.choices[0].message.content or ""


def _mock_llm_response(system_prompt: str, user_prompt: str) -> str:
    """Deterministic mock for development without an API key."""
    if "planner" in system_prompt.lower() or "break down" in system_prompt.lower():
        return json.dumps({
            "tasks": [
                {"id": 1, "type": "email_sequence", "description": "Create a 3-part email drip campaign"},
                {"id": 2, "type": "ad_copy", "description": "Write social media ad copy (Facebook + Instagram)"},
                {"id": 3, "type": "landing_page", "description": "Draft landing page hero section copy"},
            ]
        })
    if "reviewer" in system_prompt.lower() or "review" in system_prompt.lower():
        return json.dumps({
            "approved": True,
            "feedback": "Content aligns with brand guidelines. Tone is consistent. No brand-safety issues detected.",
            "issues": [],
        })
    # Writer / default
    return (
        "# Marketing Campaign Draft\n\n"
        "## Email Sequence\n"
        "**Subject:** Introducing Our New Product Line — You Won't Want to Miss This\n\n"
        "Dear [First Name],\n\n"
        "We're thrilled to announce the launch of our newest product line...\n\n"
        "## Ad Copy\n"
        "🚀 Big news! Our newest collection is here. Tap to explore →\n\n"
        "## Landing Page Hero\n"
        "**Headline:** The Future Starts Now\n"
        "**Sub-headline:** Discover innovation designed for you.\n"
    )


# ---------------------------------------------------------------------------
# 1. PLANNER NODE
# ---------------------------------------------------------------------------
def planner_node(state: AgentState) -> dict[str, Any]:
    """Decompose the user prompt into structured sub-tasks."""
    user_prompt = state.get("user_prompt", "")
    logger.info("[Planner] Processing prompt: %s", user_prompt[:120])

    system_prompt = (
        "You are a senior marketing strategist and project planner.\n"
        "Given a user's campaign request, break it down into specific, "
        "actionable sub-tasks for a content-generation team.\n\n"
        "Return a JSON object with a 'tasks' array. Each task must have:\n"
        "  - id (int)\n"
        "  - type (string): one of email_sequence, ad_copy, landing_page, "
        "blog_post, social_media, sms, push_notification, video_script\n"
        "  - description (string): a clear brief for the writer\n\n"
        "Only return valid JSON, no markdown fences."
    )

    raw = _call_llm(system_prompt, user_prompt, temperature=0.4)

    # Parse the task plan
    try:
        # Strip markdown fences if present
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1]
            cleaned = cleaned.rsplit("```", 1)[0]
        plan = json.loads(cleaned)
        tasks = plan.get("tasks", [])
    except (json.JSONDecodeError, AttributeError) as exc:
        logger.warning("[Planner] Could not parse LLM JSON: %s — using raw text", exc)
        tasks = [{"id": 1, "type": "general", "description": raw}]

    logger.info("[Planner] Generated %d sub-tasks.", len(tasks))

    return {
        "task_plan": tasks,
        "messages": state.get("messages", []) + [
            {"role": "assistant", "content": f"[Planner] Created {len(tasks)} sub-tasks."},
        ],
        "iteration_count": 0,
    }


# ---------------------------------------------------------------------------
# 2. WRITER / EXECUTION NODE
# ---------------------------------------------------------------------------
def writer_node(state: AgentState) -> dict[str, Any]:
    """Retrieve brand context and generate marketing assets."""
    brand_id = state.get("brand_id", "")
    user_prompt = state.get("user_prompt", "")
    task_plan = state.get("task_plan", [])
    feedback = state.get("feedback", "")
    iteration = state.get("iteration_count", 0)

    logger.info("[Writer] Iteration %d — generating content for brand_id=%s", iteration, brand_id)

    # --- Retrieve brand context from Context Vault ---
    context_results = []
    if brand_id:
        context_results = retrieve_brand_context(
            query=user_prompt,
            brand_id=brand_id,
            limit=5,
        )
    brand_context_text = "\n\n".join(
        r.get("payload", {}).get("text", "") for r in context_results
    ) if context_results else "No brand context available."

    logger.info("[Writer] Retrieved %d context snippets.", len(context_results))

    # --- Build the task description ---
    task_descriptions = "\n".join(
        f"- [{t.get('type', 'general')}] {t.get('description', '')}" for t in task_plan
    ) if task_plan else "Generate marketing content as requested."

    # --- Build revision context if any ---
    revision_context = ""
    if feedback and iteration > 0:
        revision_context = (
            f"\n\nREVISION REQUEST (iteration {iteration}):\n"
            f"The reviewer provided the following feedback. "
            f"Address all issues:\n{feedback}\n"
        )

    system_prompt = (
        "You are an expert marketing copywriter.\n"
        "Generate high-quality marketing content based on the task plan below.\n"
        "Ensure the tone and style match the brand context provided.\n\n"
        "BRAND CONTEXT:\n"
        f"{brand_context_text}\n\n"
        "TASK PLAN:\n"
        f"{task_descriptions}\n"
        f"{revision_context}\n\n"
        "Generate all requested assets in a well-structured format "
        "with clear headings for each asset type. "
        "Use markdown formatting."
    )

    draft = _call_llm(system_prompt, user_prompt, temperature=0.7)

    logger.info("[Writer] Draft generated (%d chars).", len(draft))

    return {
        "current_draft": draft,
        "brand_context": context_results,
        "messages": state.get("messages", []) + [
            {"role": "assistant", "content": f"[Writer] Generated draft (iteration {iteration})."},
        ],
    }


# ---------------------------------------------------------------------------
# 3. REVIEWER NODE
# ---------------------------------------------------------------------------
def reviewer_node(state: AgentState) -> dict[str, Any]:
    """Validate generated content against brand safety and formatting rules."""
    current_draft = state.get("current_draft", "")
    user_prompt = state.get("user_prompt", "")
    iteration = state.get("iteration_count", 0)
    task_plan = state.get("task_plan", [])

    logger.info("[Reviewer] Reviewing draft (iteration %d, %d chars).", iteration, len(current_draft))

    # --- Check iteration limit ---
    if iteration >= MAX_ITERATIONS:
        logger.warning("[Reviewer] Max iterations (%d) reached — auto-approving.", MAX_ITERATIONS)
        return {
            "final_approved": True,
            "feedback": f"Auto-approved after {MAX_ITERATIONS} iterations (iteration limit reached).",
            "iteration_count": iteration,
            "messages": state.get("messages", []) + [
                {"role": "assistant", "content": f"[Reviewer] Auto-approved (max iterations)."}
            ],
        }

    # --- Build expected assets list ---
    expected_assets = ", ".join(
        t.get("type", "general") for t in task_plan
    ) if task_plan else "general content"

    system_prompt = (
        "You are a senior brand safety reviewer and content quality analyst.\n"
        "Review the following marketing content draft and check:\n\n"
        "1. **Brand Safety**: No offensive, discriminatory, or controversial content.\n"
        "2. **Tone Consistency**: Professional, on-brand tone throughout.\n"
        "3. **Completeness**: All requested asset types are present: "
        f"{expected_assets}\n"
        "4. **Formatting**: Proper markdown structure with clear headings.\n"
        "5. **Quality**: Content is specific, actionable, and not generic filler.\n\n"
        "Return a JSON object with:\n"
        "  - approved (bool): true if content passes all checks\n"
        "  - feedback (string): detailed feedback\n"
        "  - issues (array of strings): specific issues found (empty if approved)\n\n"
        "Only return valid JSON, no markdown fences."
    )

    user_msg = (
        f"ORIGINAL REQUEST: {user_prompt}\n\n"
        f"DRAFT TO REVIEW:\n{current_draft}"
    )

    raw = _call_llm(system_prompt, user_msg, temperature=0.2)

    # Parse review result
    try:
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1]
            cleaned = cleaned.rsplit("```", 1)[0]
        review = json.loads(cleaned)
        approved = review.get("approved", False)
        feedback_text = review.get("feedback", "")
        issues = review.get("issues", [])
    except (json.JSONDecodeError, AttributeError) as exc:
        logger.warning("[Reviewer] Could not parse LLM JSON: %s — defaulting to approved.", exc)
        approved = True
        feedback_text = raw
        issues = []

    if issues:
        feedback_text += "\nIssues: " + "; ".join(issues)

    logger.info("[Reviewer] Decision: %s (issues: %d)", "APPROVED" if approved else "REVISE", len(issues))

    return {
        "final_approved": approved,
        "feedback": feedback_text,
        "iteration_count": iteration + 1,
        "messages": state.get("messages", []) + [
            {
                "role": "assistant",
                "content": f"[Reviewer] {'Approved' if approved else 'Revision needed'}: {feedback_text[:200]}",
            },
        ],
    }
