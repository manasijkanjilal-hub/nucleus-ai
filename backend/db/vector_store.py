"""Qdrant vector-store wrapper for the Context Vault (Module A).

Provides helpers to:
  1. Ensure the collection exists.
  2. Upsert embedding vectors with metadata.
  3. Query by similarity with metadata filters.

If the Qdrant server is unreachable the module falls back to a simple
in-memory mock so local development works without Docker.
"""
from __future__ import annotations

import logging
import uuid
from typing import Any

from qdrant_client import QdrantClient
from qdrant_client.http.exceptions import UnexpectedResponse
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PointStruct,
    VectorParams,
)

from core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# ---------------------------------------------------------------------------
# In-memory fallback when Qdrant is not running
# ---------------------------------------------------------------------------
_MOCK_STORE: list[dict[str, Any]] = []
_USE_MOCK: bool = False


def _get_client() -> QdrantClient | None:
    """Try to connect to Qdrant; return None on failure."""
    global _USE_MOCK
    try:
        client = QdrantClient(url=settings.QDRANT_URL, timeout=5)
        client.get_collections()  # health check
        _USE_MOCK = False
        return client
    except Exception:
        logger.warning("Qdrant unreachable — falling back to in-memory mock store.")
        _USE_MOCK = True
        return None


def ensure_collection() -> None:
    """Create the Qdrant collection if it doesn’t already exist."""
    client = _get_client()
    if client is None:
        return
    try:
        client.get_collection(settings.QDRANT_COLLECTION)
        logger.info("Collection '%s' already exists.", settings.QDRANT_COLLECTION)
    except (UnexpectedResponse, Exception):
        client.create_collection(
            collection_name=settings.QDRANT_COLLECTION,
            vectors_config=VectorParams(
                size=settings.VECTOR_DIMENSION,
                distance=Distance.COSINE,
            ),
        )
        logger.info("Created Qdrant collection '%s'.", settings.QDRANT_COLLECTION)


def upsert_vectors(
    vectors: list[list[float]],
    payloads: list[dict[str, Any]],
    ids: list[str] | None = None,
) -> int:
    """Insert/update vectors with payloads.  Returns count of points upserted."""
    if ids is None:
        ids = [str(uuid.uuid4()) for _ in vectors]

    if _USE_MOCK or _get_client() is None:
        for vid, vec, pay in zip(ids, vectors, payloads):
            _MOCK_STORE.append({"id": vid, "vector": vec, "payload": pay})
        logger.info("Mock-stored %d vectors.", len(vectors))
        return len(vectors)

    client = _get_client()
    points = [
        PointStruct(id=vid, vector=vec, payload=pay)
        for vid, vec, pay in zip(ids, vectors, payloads)
    ]
    client.upsert(collection_name=settings.QDRANT_COLLECTION, points=points)  # type: ignore[union-attr]
    return len(points)


def search_vectors(
    query_vector: list[float],
    limit: int = 5,
    brand_id: str | None = None,
    content_type: str | None = None,
    vertical: str | None = None,
) -> list[dict[str, Any]]:
    """Similarity search with optional metadata filters."""
    if _USE_MOCK or _get_client() is None:
        # Naive mock: return first `limit` items (no real similarity)
        return [{"id": p["id"], "score": 1.0, "payload": p["payload"]} for p in _MOCK_STORE[:limit]]

    must_conditions = []
    if brand_id:
        must_conditions.append(FieldCondition(key="brand_id", match=MatchValue(value=brand_id)))
    if content_type:
        must_conditions.append(FieldCondition(key="content_type", match=MatchValue(value=content_type)))
    if vertical:
        must_conditions.append(FieldCondition(key="vertical", match=MatchValue(value=vertical)))

    query_filter = Filter(must=must_conditions) if must_conditions else None

    client = _get_client()
    results = client.search(  # type: ignore[union-attr]
        collection_name=settings.QDRANT_COLLECTION,
        query_vector=query_vector,
        limit=limit,
        query_filter=query_filter,
    )
    return [{"id": str(r.id), "score": r.score, "payload": r.payload} for r in results]
