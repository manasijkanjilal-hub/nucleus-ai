"""Application configuration loaded from environment variables."""
from __future__ import annotations

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # ---- App ----
    APP_NAME: str = "Nucleus AI"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True

    # ---- Database ----
    DATABASE_URL: str = "postgresql+asyncpg://nucleus:nucleus@localhost:5432/nucleus"
    DATABASE_URL_SYNC: str = "postgresql+psycopg2://nucleus:nucleus@localhost:5432/nucleus"

    # ---- OpenAI ----
    OPENAI_API_KEY: str = ""
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    LLM_MODEL: str = "gpt-4o-mini"

    # ---- Vector DB (Qdrant) ----
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_COLLECTION: str = "nucleus_context"
    VECTOR_DIMENSION: int = 1536  # text-embedding-3-small dimension

    # ---- CORS ----
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # ---- Chunking ----
    CHUNK_SIZE: int = 800
    CHUNK_OVERLAP: int = 200

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
