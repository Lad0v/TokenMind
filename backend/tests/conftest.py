"""
Common test fixtures for FastAPI + SQLAlchemy 2.0 async test suite.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import AsyncGenerator
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from jose import jwt
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import Settings
from app.core.database import Base, get_db
from app.core.security import create_access_token, create_refresh_token
from app.main import app
from app.models.user import User, UserRole, UserStatus
from app.services.user_service import UserService


# ---------------------------------------------------------------------------
# Engine & Session
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def event_loop():
    import asyncio
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def async_engine():
    """In-memory SQLite engine, shared per session scope."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def db_session(async_engine) -> AsyncGenerator[AsyncSession, None]:
    """AsyncSession with rollback after each test (never commits to DB)."""
    session_factory = async_sessionmaker(
        async_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_factory() as session:
        try:
            yield session
        finally:
            await session.rollback()
            await session.close()


# Override FastAPI dependency
@pytest_asyncio.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """AsyncClient with ASGITransport, base_url='http://test'."""

    async def _get_db_override():
        yield db_session

    app.dependency_overrides[get_db] = _get_db_override

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# User Factory
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def make_user(db_session: AsyncSession):
    """Factory: make_user(role='user', status='active', **kwargs) -> User."""

    async def _make(
        role: str = "user",
        status: str = "active",
        email: str | None = None,
        password: str = "TestPassword123!",
        **kwargs,
    ) -> User:
        email = email or f"test-{uuid.uuid4().hex[:8]}@example.com"
        user = User(
            email=email.lower().strip(),
            password_hash=UserService.hash_password(password),
            role=role,
            status=status,
        )
        db_session.add(user)
        await db_session.flush()
        await db_session.refresh(user)
        return user

    return _make


# ---------------------------------------------------------------------------
# Auth Helpers
# ---------------------------------------------------------------------------

@pytest.fixture
def auth_headers(make_user, db_session):
    """
    Fixture factory: auth_headers(user) -> {"Authorization": "Bearer <token>"}.
    Usage:  headers = auth_headers(await make_user())  -- use inside test.
    """

    def _build(user: User) -> dict[str, str]:
        token = create_access_token(subject=user.email)
        return {"Authorization": f"Bearer {token}"}

    return _build


@pytest.fixture
def test_settings():
    """Override settings for tests."""
    return Settings(
        SECRET_KEY="test-secret-key-32bytes-padding!",
        JWT_ALGORITHM="HS256",
        ACCESS_TOKEN_EXPIRE_MINUTES=30,
        REFRESH_TOKEN_EXPIRE_MINUTES=10080,
        OTP_TOKEN_EXPIRE_MINUTES=10,
        PASSWORD_RESET_TOKEN_EXPIRE_MINUTES=30,
    )


@pytest.fixture
def dummy_password() -> str:
    return "TestPassword123!"


@pytest.fixture
def generate_jwt():
    """Helper to generate JWT tokens with custom claims."""

    def _generate(
        subject: str = "test@example.com",
        token_type: str = "access",
        expires_delta: timedelta | None = None,
        extra_claims: dict | None = None,
    ) -> str:
        expire = datetime.now(timezone.utc) + (
            expires_delta or timedelta(minutes=30)
        )
        payload = {
            "sub": subject,
            "type": token_type,
            "exp": expire,
            "iat": datetime.now(timezone.utc),
            "jti": uuid.uuid4().hex,
        }
        if extra_claims:
            payload.update(extra_claims)
        return jwt.encode(
            payload,
            "test-secret-key-32bytes-padding!",
            algorithm="HS256",
        )

    return _generate
