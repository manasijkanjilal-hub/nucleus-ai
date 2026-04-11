"""Context Vault endpoints (Module A).

POST /api/v1/context/ingest
  • Accepts raw text **or** an uploaded PDF file.
  • Chunks the content using LangChain’s RecursiveCharacterTextSplitter.
  • Generates embeddings via OpenAI text-embedding-3-small.
  • Upserts into Qdrant (or mock store) with metadata filters.

POST /api/v1/context/search
  • Semantic similarity search over the Context Vault.
"""
from __future__ import annotations

import logging
import uuid
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from core.config import get_settings
from core.security import scrub_pii
from db.vector_store import ensure_collection, search_vectors, upsert_vectors

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/context", tags=["Context Vault"])


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
def _chunk_text(text: str) -> list[str]:
    """Split text into overlapping chunks."""
    from langchain.text_splitter import RecursiveCharacterTextSplitter

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.CHUNK_SIZE,
        chunk_overlap=settings.CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    return splitter.split_text(text)


def _extract_pdf_text(file_bytes: bytes) -> str:
    """Extract plain text from a PDF."""
    from PyPDF2 import PdfReader
    import io

    reader = PdfReader(io.BytesIO(file_bytes))
    pages = [page.extract_text() or "" for page in reader.pages]
    return "\n".join(pages)


async def _embed_texts(texts: list[str]) -> list[list[float]]:
    """Generate embeddings using OpenAI.

    Falls back to random vectors if the API key is not configured.
    """
    if not settings.OPENAI_API_KEY:
        import random
        logger.warning("OPENAI_API_KEY not set — returning random mock embeddings.")
        return [[random.random() for _ in range(settings.VECTOR_DIMENSION)] for _ in texts]

    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    response = await client.embeddings.create(
        input=texts,
        model=settings.EMBEDDING_MODEL,
    )
    return [item.embedding for item in response.data]


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------
class IngestResponse(BaseModel):
    status: str = "ok"
    chunks_created: int
    brand_id: str
    content_type: str


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    brand_id: Optional[str] = None
    content_type: Optional[str] = None
    vertical: Optional[str] = None
    limit: int = Field(5, ge=1, le=50)


class SearchResult(BaseModel):
    id: str
    score: float
    payload: dict


class SearchResponse(BaseModel):
    results: list[SearchResult]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.post("/ingest", response_model=IngestResponse)
async def ingest_context(
    brand_id: str = Form(...),
    content_type: str = Form("general"),       # e.g. brand_guide, faq, product, blog
    vertical: str = Form("general"),           # e.g. SaaS, eCommerce, Finance
    text: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
):
    """Ingest text or PDF into the Context Vault."""

    # 1. Extract raw text --------------------------------------------------
    raw_text: str = ""
    if file and file.filename:
        file_bytes = await file.read()
        if file.content_type == "application/pdf" or (file.filename and file.filename.endswith(".pdf")):
            raw_text = _extract_pdf_text(file_bytes)
        else:
            raw_text = file_bytes.decode("utf-8", errors="ignore")
    elif text:
        raw_text = text
    else:
        raise HTTPException(status_code=400, detail="Provide either `text` or a `file`.")

    if not raw_text.strip():
        raise HTTPException(status_code=400, detail="Extracted content is empty.")

    # 2. PII scrub ---------------------------------------------------------
    clean_text = scrub_pii(raw_text)

    # 3. Chunk -------------------------------------------------------------
    chunks = _chunk_text(clean_text)
    logger.info("Created %d chunks for brand_id=%s", len(chunks), brand_id)

    # 4. Embed -------------------------------------------------------------
    embeddings = await _embed_texts(chunks)

    # 5. Build payloads & upsert -------------------------------------------
    ensure_collection()
    ids = [str(uuid.uuid4()) for _ in chunks]
    payloads = [
        {
            "brand_id": brand_id,
            "content_type": content_type,
            "vertical": vertical,
            "text": chunk,
        }
        for chunk in chunks
    ]
    upserted = upsert_vectors(embeddings, payloads, ids)

    return IngestResponse(
        chunks_created=upserted,
        brand_id=brand_id,
        content_type=content_type,
    )


@router.post("/search", response_model=SearchResponse)
async def search_context(body: SearchRequest):
    """Semantic search over the Context Vault."""
    query_embedding = (await _embed_texts([body.query]))[0]
    results = search_vectors(
        query_vector=query_embedding,
        limit=body.limit,
        brand_id=body.brand_id,
        content_type=body.content_type,
        vertical=body.vertical,
    )
    return SearchResponse(results=[SearchResult(**r) for r in results])
