"""Workflow API endpoints (Module B — Agentic Workflow Engine).

POST /api/v1/workflow/execute
  Triggers the multi-agent LangGraph pipeline:
  Planner → Writer → Reviewer (with revision loop).
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field

from agents.graph import run_workflow

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/workflow", tags=["Workflow Engine"])


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------
class WorkflowRequest(BaseModel):
    """Input to trigger a workflow execution."""
    prompt: str = Field(
        ...,
        min_length=5,
        description="User campaign prompt, e.g. 'Launch a Q3 integrated campaign for our new product line'",
        examples=["Launch a Q3 integrated campaign for our new product line"],
    )
    brand_id: str = Field(
        ...,
        min_length=1,
        description="Brand identifier to scope Context Vault queries.",
        examples=["brand_acme_123"],
    )


class TaskItem(BaseModel):
    id: int | str
    type: str
    description: str


class WorkflowResponse(BaseModel):
    """Output from a completed workflow execution."""
    status: str = "completed"
    brand_id: str
    prompt: str
    task_plan: list[dict[str, Any]]
    generated_content: str
    reviewer_feedback: str
    approved: bool
    iterations: int
    messages: list[dict[str, Any]]
    error: Optional[str] = None


# --- Async job tracking (lightweight in-memory store for demo) ---
_job_store: dict[str, dict[str, Any]] = {}


class AsyncWorkflowResponse(BaseModel):
    """Acknowledgement when a workflow is queued for background execution."""
    status: str = "queued"
    job_id: str
    message: str = "Workflow is running in the background. Poll /api/v1/workflow/status/{job_id} for results."


class JobStatusResponse(BaseModel):
    """Status of an async workflow job."""
    job_id: str
    status: str  # queued | running | completed | failed
    result: Optional[WorkflowResponse] = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.post("/execute", response_model=WorkflowResponse)
def execute_workflow(body: WorkflowRequest):
    """Execute the multi-agent workflow synchronously.

    Runs Planner → Writer → Reviewer and returns the final output.
    For long-running campaigns, use the async endpoint instead.
    """
    logger.info("Workflow execute: brand_id=%s, prompt='%s'", body.brand_id, body.prompt[:80])

    try:
        result = run_workflow(
            user_prompt=body.prompt,
            brand_id=body.brand_id,
        )
    except Exception as exc:
        logger.error("Workflow failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Workflow execution failed: {exc}")

    if result.get("error"):
        raise HTTPException(status_code=500, detail=result["error"])

    return WorkflowResponse(
        status="completed",
        brand_id=body.brand_id,
        prompt=body.prompt,
        task_plan=result.get("task_plan", []),
        generated_content=result.get("current_draft", ""),
        reviewer_feedback=result.get("feedback", ""),
        approved=result.get("final_approved", False),
        iterations=result.get("iteration_count", 0),
        messages=result.get("messages", []),
    )


@router.post("/execute/async", response_model=AsyncWorkflowResponse)
def execute_workflow_async(body: WorkflowRequest, background_tasks: BackgroundTasks):
    """Queue a workflow for background execution.

    Returns a job_id immediately. Poll /status/{job_id} for results.
    """
    import uuid

    job_id = str(uuid.uuid4())
    _job_store[job_id] = {"status": "queued", "result": None}
    logger.info("Async workflow queued: job_id=%s, brand_id=%s", job_id, body.brand_id)

    def _run_in_background(jid: str, prompt: str, bid: str):
        _job_store[jid]["status"] = "running"
        try:
            result = run_workflow(user_prompt=prompt, brand_id=bid)
            _job_store[jid]["status"] = "completed" if not result.get("error") else "failed"
            _job_store[jid]["result"] = {
                "status": _job_store[jid]["status"],
                "brand_id": bid,
                "prompt": prompt,
                "task_plan": result.get("task_plan", []),
                "generated_content": result.get("current_draft", ""),
                "reviewer_feedback": result.get("feedback", ""),
                "approved": result.get("final_approved", False),
                "iterations": result.get("iteration_count", 0),
                "messages": result.get("messages", []),
                "error": result.get("error"),
            }
        except Exception as exc:
            _job_store[jid]["status"] = "failed"
            _job_store[jid]["result"] = {"error": str(exc)}

    background_tasks.add_task(_run_in_background, job_id, body.prompt, body.brand_id)

    return AsyncWorkflowResponse(job_id=job_id)


@router.get("/status/{job_id}", response_model=JobStatusResponse)
def get_workflow_status(job_id: str):
    """Check the status of an async workflow job."""
    job = _job_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found.")

    return JobStatusResponse(
        job_id=job_id,
        status=job["status"],
        result=job.get("result"),
    )
