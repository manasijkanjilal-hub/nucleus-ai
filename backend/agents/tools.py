"""Custom LangChain tools for agents — Context Vault retrieval.

Provides a tool the Execution/Writer agent can invoke to pull relevant
brand guidelines, tone, and past content from the Qdrant vector store.
"""
from __future__ import annotations

import logging
from typing import Any

from langchain_core.tools import tool

from core.config import get_settings
from db.vector_store import search_vectors

logger = logging.getLogger(__name__)
settings = get_settings()


# ---------------------------------------------------------------------------
# Embedding helper (reuses the same logic as context.py)
# ---------------------------------------------------------------------------
async def _embed_query(text: str) -> list[float]:
    """Generate an embedding vector for *text*."""
    if not settings.OPENAI_API_KEY:
        import random
        logger.warning("OPENAI_API_KEY not set — returning random mock embedding.")
        return [random.random() for _ in range(settings.VECTOR_DIMENSION)]

    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    response = await client.embeddings.create(
        input=[text],
        model=settings.EMBEDDING_MODEL,
    )
    return response.data[0].embedding


def _embed_query_sync(text: str) -> list[float]:
    """Synchronous wrapper for embedding generation."""
    if not settings.OPENAI_API_KEY:
        import random
        logger.warning("OPENAI_API_KEY not set — returning random mock embedding.")
        return [random.random() for _ in range(settings.VECTOR_DIMENSION)]

    from openai import OpenAI

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    response = client.embeddings.create(
        input=[text],
        model=settings.EMBEDDING_MODEL,
    )
    return response.data[0].embedding


# ---------------------------------------------------------------------------
# LangChain Tool — Context Vault search
# ---------------------------------------------------------------------------
@tool
def search_brand_context(
    query: str,
    brand_id: str,
    content_type: str | None = None,
    limit: int = 5,
) -> list[dict[str, Any]]:
    """Search the Context Vault for brand-relevant information.

    Use this to retrieve brand guidelines, tone of voice, past successful
    content, or product details before generating marketing assets.

    Args:
        query: Natural-language description of what context you need.
        brand_id: The brand identifier to scope the search.
        content_type: Optional filter (brand_guide, faq, product, blog).
        limit: Max number of results to return.

    Returns:
        A list of matching context snippets with metadata.
    """
    try:
        embedding = _embed_query_sync(query)
        results = search_vectors(
            query_vector=embedding,
            limit=limit,
            brand_id=brand_id,
            content_type=content_type,
        )
        logger.info(
            "Context Vault returned %d results for brand_id=%s, query='%s'",
            len(results), brand_id, query[:80],
        )
        return results
    except Exception as exc:
        logger.error("Context Vault search failed: %s", exc)
        return []


def retrieve_brand_context(
    query: str,
    brand_id: str,
    content_type: str | None = None,
    limit: int = 5,
) -> list[dict[str, Any]]:
    """Direct (non-tool) helper for retrieving brand context."""
    return search_brand_context.invoke({
        "query": query,
        "brand_id": brand_id,
        "content_type": content_type,
        "limit": limit,
    })
