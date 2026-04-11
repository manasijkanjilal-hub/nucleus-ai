"""Nucleus AI — FastAPI application entry-point."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import get_settings
from db.database import init_db

settings = get_settings()

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lifespan (startup / shutdown)
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting %s v%s", settings.APP_NAME, settings.APP_VERSION)
    # Create tables on startup (dev only — use Alembic in production)
    try:
        await init_db()
        logger.info("Database tables ensured.")
    except Exception as exc:
        logger.warning("Could not initialise DB (is Postgres running?): %s", exc)
    yield
    logger.info("Shutting down %s", settings.APP_NAME)


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Register routers
# ---------------------------------------------------------------------------
from api.v1.health import router as health_router  # noqa: E402
from api.v1.context import router as context_router  # noqa: E402
from api.v1.workflow import router as workflow_router  # noqa: E402

app.include_router(health_router, prefix="/api/v1")
app.include_router(context_router, prefix="/api/v1")
app.include_router(workflow_router, prefix="/api/v1")
