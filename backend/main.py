"""FastAPI application entry point.

Provides:
- Lifespan management for DB engine, Redis, and HTTP clients
- CORS middleware
- Router inclusion
- Health check endpoints
"""

import logging
from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.core.database import engine, close_redis, init_db
from app.api.v1.router import router as api_v1_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan: startup and shutdown."""
    # --- Startup ---
    logger.info("Starting %s v%s", settings.PROJECT_NAME, settings.VERSION)

    # Create database tables (development only; use Alembic in production)
    if settings.DEBUG:
        logger.info("DEBUG mode: creating database tables")
        await init_db()

    logger.info("Application ready")

    yield

    # --- Shutdown ---
    logger.info("Shutting down application")
    await close_redis()
    await engine.dispose()
    logger.info("Application stopped")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=settings.DESCRIPTION,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# --- Middleware ---
if settings.ENABLE_CORS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


# --- Exception Handlers ---

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    """Return structured validation errors."""
    return JSONResponse(
        status_code=422,
        content={
            "error": "validation_error",
            "detail": exc.errors(),
        },
    )


@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(
    request: Request,
    exc: SQLAlchemyError,
) -> JSONResponse:
    """Handle database errors gracefully."""
    logger.exception("Database error: %s", exc)
    return JSONResponse(
        status_code=500,
        content={
            "error": "database_error",
            "detail": "Internal database error occurred",
        },
    )


@app.exception_handler(Exception)
async def general_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    """Catch-all for unhandled exceptions."""
    logger.exception("Unhandled exception: %s", exc)
    return JSONResponse(
        status_code=500,
        content={
            "error": "internal_server_error",
            "detail": "An unexpected error occurred",
        },
    )


# --- Routes ---
app.include_router(api_v1_router, prefix="/api/v1")


@app.get("/", tags=["Health"])
async def root():
    return {"status": "ok", "version": settings.VERSION}


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "healthy"}
