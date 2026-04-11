"""Tests for the Multi-Agent Workflow Engine (Module B).

Covers:
  - State schema validation
  - Individual agent nodes (Planner, Writer, Reviewer)
  - LangGraph workflow execution end-to-end
  - API endpoint integration tests
"""
from __future__ import annotations

import sys
import os

# Ensure backend is on the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# State schema tests
# ---------------------------------------------------------------------------
class TestAgentState:
    def test_state_has_required_fields(self):
        from agents.state import AgentState

        required = [
            "messages", "brand_context", "current_draft", "feedback",
            "task_plan", "brand_id", "iteration_count", "user_prompt",
            "final_approved", "error",
        ]
        for field in required:
            assert field in AgentState.__annotations__, f"Missing field: {field}"

    def test_state_is_typed_dict(self):
        from agents.state import AgentState
        # TypedDict subclasses dict
        state: AgentState = {
            "messages": [],
            "brand_context": [],
            "current_draft": "",
            "feedback": "",
            "task_plan": [],
            "brand_id": "test",
            "iteration_count": 0,
            "user_prompt": "test prompt",
            "final_approved": False,
            "error": None,
        }
        assert state["brand_id"] == "test"


# ---------------------------------------------------------------------------
# Node tests (using mock LLM — no API key needed)
# ---------------------------------------------------------------------------
class TestPlannerNode:
    def test_planner_produces_task_plan(self):
        from agents.nodes import planner_node

        state = {
            "user_prompt": "Launch a Q3 campaign for our new product",
            "messages": [],
            "iteration_count": 0,
        }
        result = planner_node(state)
        assert "task_plan" in result
        assert len(result["task_plan"]) > 0
        assert result["iteration_count"] == 0

    def test_planner_updates_messages(self):
        from agents.nodes import planner_node

        state = {"user_prompt": "Create email campaign", "messages": [], "iteration_count": 0}
        result = planner_node(state)
        assert len(result["messages"]) > 0
        assert "[Planner]" in result["messages"][-1]["content"]


class TestWriterNode:
    def test_writer_produces_draft(self):
        from agents.nodes import writer_node

        state = {
            "user_prompt": "Launch a campaign",
            "brand_id": "test_brand",
            "task_plan": [{"id": 1, "type": "email_sequence", "description": "Email drip"}],
            "feedback": "",
            "iteration_count": 0,
            "messages": [],
        }
        result = writer_node(state)
        assert "current_draft" in result
        assert len(result["current_draft"]) > 0

    def test_writer_retrieves_brand_context(self):
        from agents.nodes import writer_node

        state = {
            "user_prompt": "Write ad copy",
            "brand_id": "test_brand",
            "task_plan": [],
            "feedback": "",
            "iteration_count": 0,
            "messages": [],
        }
        result = writer_node(state)
        assert "brand_context" in result


class TestReviewerNode:
    def test_reviewer_approves_content(self):
        from agents.nodes import reviewer_node

        state = {
            "current_draft": "# Great Marketing Content\n\nHere is amazing copy.",
            "user_prompt": "Launch a campaign",
            "iteration_count": 0,
            "task_plan": [{"type": "email_sequence"}],
            "messages": [],
        }
        result = reviewer_node(state)
        assert "final_approved" in result
        assert "feedback" in result
        assert result["iteration_count"] == 1

    def test_reviewer_auto_approves_at_max_iterations(self):
        from agents.nodes import reviewer_node, MAX_ITERATIONS

        state = {
            "current_draft": "Some draft",
            "user_prompt": "Campaign",
            "iteration_count": MAX_ITERATIONS,
            "task_plan": [],
            "messages": [],
        }
        result = reviewer_node(state)
        assert result["final_approved"] is True


# ---------------------------------------------------------------------------
# Graph tests
# ---------------------------------------------------------------------------
class TestWorkflowGraph:
    def test_graph_builds_successfully(self):
        from agents.graph import build_workflow_graph
        graph = build_workflow_graph()
        assert graph is not None

    def test_full_workflow_execution(self):
        from agents.graph import run_workflow

        result = run_workflow(
            user_prompt="Launch a Q3 integrated campaign for our new product line",
            brand_id="brand_acme_123",
        )
        assert result["final_approved"] is True
        assert result["error"] is None
        assert len(result["task_plan"]) > 0
        assert len(result["current_draft"]) > 0
        assert result["iteration_count"] >= 1

    def test_workflow_preserves_brand_id(self):
        from agents.graph import run_workflow

        result = run_workflow(user_prompt="Create email campaign", brand_id="my_brand")
        assert result["brand_id"] == "my_brand"


# ---------------------------------------------------------------------------
# API endpoint tests
# ---------------------------------------------------------------------------
class TestWorkflowAPI:
    @pytest.fixture
    def client(self):
        from main import app
        return TestClient(app)

    def test_execute_endpoint_success(self, client):
        response = client.post("/api/v1/workflow/execute", json={
            "prompt": "Launch a Q3 integrated campaign for our new product line",
            "brand_id": "brand_acme_123",
        })
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "completed"
        assert data["approved"] is True
        assert len(data["task_plan"]) > 0
        assert len(data["generated_content"]) > 0

    def test_execute_endpoint_validation(self, client):
        # Too short prompt
        response = client.post("/api/v1/workflow/execute", json={
            "prompt": "hi",
            "brand_id": "x",
        })
        assert response.status_code == 422

    def test_execute_endpoint_missing_fields(self, client):
        response = client.post("/api/v1/workflow/execute", json={})
        assert response.status_code == 422

    def test_async_endpoint(self, client):
        response = client.post("/api/v1/workflow/execute/async", json={
            "prompt": "Create holiday campaign",
            "brand_id": "brand_123",
        })
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "queued"
        assert "job_id" in data

    def test_status_endpoint_not_found(self, client):
        response = client.get("/api/v1/workflow/status/nonexistent-id")
        assert response.status_code == 404


# ---------------------------------------------------------------------------
# Tools tests
# ---------------------------------------------------------------------------
class TestTools:
    def test_search_brand_context_returns_list(self):
        from agents.tools import retrieve_brand_context
        results = retrieve_brand_context(
            query="brand guidelines",
            brand_id="test_brand",
        )
        assert isinstance(results, list)

    def test_search_brand_context_tool_has_description(self):
        from agents.tools import search_brand_context
        assert search_brand_context.description
        assert "brand" in search_brand_context.description.lower()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
