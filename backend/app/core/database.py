"""Database configuration and session management.

Provides:
- Async SQLAlchemy engine setup
- AsyncSession factory
- Redis connection pool (lazy init with cleanup)
- Dependency injection for FastAPI
"""

from typing import AsyncGenerator, Optional

import redis.asyncio as aioredis

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

# ---------------------------------------------------------------------------
# Database URL normalization
# ---------------------------------------------------------------------------

DATABASE_URL = settings.DATABASE_URL
if DATABASE_URL.startswith("sqlite:///") and not DATABASE_URL.startswith(
    "sqlite+aiosqlite:///"
):
    DATABASE_URL = DATABASE_URL.replace("sqlite:///", "sqlite+aiosqlite:///", 1)

engine = create_async_engine(
    DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# Redis connection pool (lazy init)
# ---------------------------------------------------------------------------

_redis: Optional[aioredis.Redis] = None


async def get_redis() -> aioredis.Redis:
    """Get or create Redis connection pool.

    Raises:
        RuntimeError: If Redis is not configured and a feature requires it.
    """
    global _redis
    if _redis is None:
        if settings.REDIS_URL and settings.ENABLE_REDIS:
            _redis = aioredis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                encoding="utf-8",
            )
        else:
            raise RuntimeError(
                "Redis is not configured. Set REDIS_URL in .env to use OTP features."
            )
    return _redis


async def close_redis() -> None:
    """Close Redis connection pool."""
    global _redis
    if _redis:
        await _redis.close()
        _redis = None


# ---------------------------------------------------------------------------
# FastAPI Dependencies
# ---------------------------------------------------------------------------

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency for database sessions.

    Commits on success, rollbacks on failure.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()



async def init_db() -> None:
    """Create all tables. Use only in development or initial setup.

    In production, use Alembic migrations.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
