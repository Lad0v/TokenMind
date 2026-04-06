"""
Tests for /api/v1/auth/* endpoints (v3.0):
- Registration (email + wallet_address, investor only)
- Wallet login (POST /auth/login/wallet)
- Patent submission OTP flow
- OTP (Redis-based, generic)
- Refresh, logout, password reset, /me

OTP Architecture in Tests:
- Redis is mocked using unittest.mock.AsyncMock
- OTP delivery (email/SMS) is mocked to prevent real SMTP calls
- Tests verify the flow without requiring real Redis or email server
"""
from __future__ import annotations
import uuid
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole, UserStatus
from app.models.common import AuditLog
from app.models.user import WalletLink
from app.services.user_service import UserService


# ---------------------------------------------------------------------------
# 1. Registration (email + wallet, investor only)
# ---------------------------------------------------------------------------

async def test_register_investor_with_wallet(
    client: AsyncClient, db_session: AsyncSession
):
    """POST /auth/register → user created with email + wallet, status active."""
    wallet = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRrJosgAsU"
    payload = {
        "email": "investor@example.com",
        "solana_wallet_address": wallet,
        "role": "investor",
        "legal_name": "John Doe",
        "country": "US",
    }
    resp = await client.post("/api/v1/auth/register", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert "registered" in data["message"].lower()

    # Verify user in DB
    user = await UserService.get_by_email(db_session, payload["email"])
    assert user is not None
    assert user.status == UserStatus.active.value
    assert user.role == UserRole.investor.value
    assert user.password_hash is None  # No password — wallet auth only

    # WalletLink created
    from app.models.user import WalletLink
    stmt = select(WalletLink).where(WalletLink.user_id == user.id)
    wallets = (await db_session.execute(stmt)).scalars().all()
    assert len(wallets) == 1
    assert wallets[0].wallet_address == wallet
    assert wallets[0].is_primary is True


async def test_register_duplicate_wallet(
    client: AsyncClient, db_session: AsyncSession
):
    """POST /auth/register with same wallet → 400."""
    wallet = "8xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRrJosgAsU"
    payload1 = {
        "email": "user1@example.com",
        "solana_wallet_address": wallet,
        "role": "investor",
    }
    resp1 = await client.post("/api/v1/auth/register", json=payload1)
    assert resp1.status_code == 201

    payload2 = {
        "email": "user2@example.com",
        "solana_wallet_address": wallet,
        "role": "investor",
    }
    resp2 = await client.post("/api/v1/auth/register", json=payload2)
    assert resp2.status_code == 400


async def test_register_duplicate_email(
    client: AsyncClient, db_session: AsyncSession
):
    """POST /auth/register with same email → 400."""
    wallet1 = "9xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRrJosgAsU"
    wallet2 = "AxKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRrJosgAsU"
    payload1 = {
        "email": "dup@example.com",
        "solana_wallet_address": wallet1,
        "role": "investor",
    }
    resp1 = await client.post("/api/v1/auth/register", json=payload1)
    assert resp1.status_code == 201

    payload2 = {
        "email": "dup@example.com",
        "solana_wallet_address": wallet2,
        "role": "investor",
    }
    resp2 = await client.post("/api/v1/auth/register", json=payload2)
    assert resp2.status_code == 400


async def test_register_invalid_wallet(client: AsyncClient):
    """POST /auth/register with invalid wallet → 422 or 400."""
    # Too short → 422 (Pydantic min_length)
    resp = await client.post(
        "/api/v1/auth/register",
        json={"email": "test@example.com", "solana_wallet_address": "short", "role": "investor"},
    )
    assert resp.status_code == 422

    # Invalid base58 (contains 0) → 400 (custom validation) or 422
    resp = await client.post(
        "/api/v1/auth/register",
        json={"email": "test@example.com", "solana_wallet_address": "0" * 32, "role": "investor"},
    )
    assert resp.status_code in (400, 422)


# ---------------------------------------------------------------------------
# 2. Wallet Login
# ---------------------------------------------------------------------------

async def test_wallet_login_new_user(client: AsyncClient, db_session: AsyncSession):
    """Wallet login for non-existent wallet → 404 (must register first)."""
    wallet = "BxKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRrJosgAsU"
    resp = await client.post(
        "/api/v1/auth/login/wallet",
        json={"wallet_address": wallet, "network": "solana"},
    )
    assert resp.status_code == 404


async def test_wallet_login_existing_user(
    client: AsyncClient, db_session: AsyncSession
):
    """Wallet login for existing user → 200, tokens returned."""
    wallet = "CxKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRrJosgAsU"

    # First register
    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={"email": "walletuser@example.com", "solana_wallet_address": wallet, "role": "investor"},
    )
    assert reg_resp.status_code == 201

    # Then login
    login_resp = await client.post(
        "/api/v1/auth/login/wallet",
        json={"wallet_address": wallet, "network": "solana"},
    )
    assert login_resp.status_code == 200
    data = login_resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["role"] == "investor"
    assert data["is_new_user"] is False


async def test_wallet_login_suspended_user(
    client: AsyncClient, db_session: AsyncSession
):
    """Wallet login for suspended user → 403."""
    from app.models.user import WalletLink

    wallet = "DxKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRrJosgAsU"

    # Create user manually with suspended status
    user = User(
        email="suspended@example.com",
        password_hash=None,
        role=UserRole.investor.value,
        status=UserStatus.suspended.value,
    )
    db_session.add(user)
    await db_session.flush()

    wl = WalletLink(
        user_id=user.id,
        wallet_address=wallet,
        network="solana",
        is_primary=True,
    )
    db_session.add(wl)
    await db_session.flush()

    resp = await client.post(
        "/api/v1/auth/login/wallet",
        json={"wallet_address": wallet, "network": "solana"},
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# 3. Patent Submission OTP Flow
# ---------------------------------------------------------------------------

async def test_submit_patent_investor(
    client: AsyncClient, db_session: AsyncSession
):
    """POST /auth/submit-patent → OTP sent, submission_id returned."""
    wallet = "ExKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRrJosgAsU"

    # Register investor
    await client.post(
        "/api/v1/auth/register",
        json={"email": "patentuser@example.com", "solana_wallet_address": wallet, "role": "investor"},
    )

    # Login to get tokens
    login_resp = await client.post(
        "/api/v1/auth/login/wallet",
        json={"wallet_address": wallet, "network": "solana"},
    )
    tokens = login_resp.json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    # Submit patent
    with patch("app.services.otp_service.send_email_otp"):
        patent_payload = {
            "patent_number": "US1234567",
            "patent_title": "Test Patent",
            "claimed_owner_name": "John Doe",
            "email": "patentuser@example.com",
            "phone": "+1234567890",
            "description": "Test description",
            "jurisdiction": "US",
        }
        resp = await client.post(
            "/api/v1/auth/submit-patent",
            json=patent_payload,
            headers=headers,
        )
    assert resp.status_code == 200
    data = resp.json()
    assert "submission_id" in data
    assert "otp_sent_to" in data
    assert data["otp_purpose"] == "patent_submission"


async def test_submit_patent_issuer_fails(
    client: AsyncClient, db_session: AsyncSession
):
    """POST /auth/submit-patent → 400 if user is already issuer."""
    wallet = "FxKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRrJosgAsU"

    # Create issuer manually
    user = User(
        email="issuer@example.com",
        password_hash=None,
        role=UserRole.issuer.value,
        status=UserStatus.active.value,
    )
    db_session.add(user)
    await db_session.flush()

    wl = WalletLink(
        user_id=user.id,
        wallet_address=wallet,
        network="solana",
        is_primary=True,
    )
    db_session.add(wl)
    await db_session.flush()

    # Login
    login_resp = await client.post(
        "/api/v1/auth/login/wallet",
        json={"wallet_address": wallet, "network": "solana"},
    )
    tokens = login_resp.json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    patent_payload = {
        "patent_number": "US7654321",
        "patent_title": "Another Patent",
        "claimed_owner_name": "Jane Doe",
        "email": "issuer@example.com",
        "phone": "+0987654321",
    }
    resp = await client.post(
        "/api/v1/auth/submit-patent",
        json=patent_payload,
        headers=headers,
    )
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# 4. Generic OTP Endpoints (Redis-based)
# ---------------------------------------------------------------------------

async def test_otp_send_email(mock_redis_client):
    """POST /auth/otp-send with email → Redis stored, email sent."""
    from app.services.otp_service import generate_and_send_otp

    with patch("app.services.otp_service.send_email_otp") as mock_send:
        await generate_and_send_otp(mock_redis_client, "test@example.com", "register")
        mock_redis_client.set.assert_called_once()
        mock_send.assert_called_once()


async def test_otp_verify_success(mock_redis_client):
    """POST /auth/otp-verify → valid code returns True."""
    import time
    from app.services.otp_service import verify_otp, _hash_otp
    import json

    # Pre-populate Redis with valid OTP
    code = "123456"
    payload = json.dumps({
        "otp_hash": _hash_otp(code),
        "attempts_left": 5,
        "expires_at": time.time() + 300,
    })
    mock_redis_client.get = AsyncMock(return_value=payload)

    result = await verify_otp(mock_redis_client, "test@example.com", code, "register")
    assert result is True
    mock_redis_client.delete.assert_called_once()


async def test_otp_verify_invalid_code(mock_redis_client):
    """POST /auth/otp-verify → wrong code decrements attempts."""
    import time
    from app.services.otp_service import verify_otp, _hash_otp
    import json

    code = "123456"
    payload = json.dumps({
        "otp_hash": _hash_otp(code),
        "attempts_left": 5,
        "expires_at": time.time() + 300,
    })
    mock_redis_client.get = AsyncMock(return_value=payload)

    with pytest.raises(ValueError, match="OTP_INVALID"):
        await verify_otp(mock_redis_client, "test@example.com", "000000", "register")


async def test_otp_verify_expired(mock_redis_client):
    """POST /auth/otp-verify → expired OTP raises OTP_EXPIRED."""
    from app.services.otp_service import verify_otp

    mock_redis_client.get = AsyncMock(return_value=None)

    with pytest.raises(ValueError, match="OTP_EXPIRED"):
        await verify_otp(mock_redis_client, "test@example.com", "123456", "register")


# ---------------------------------------------------------------------------
# 5. Refresh Token
# ---------------------------------------------------------------------------

async def test_refresh_token_success(client: AsyncClient, db_session: AsyncSession):
    """POST /auth/refresh → 200, new access token."""
    from app.core.security import create_refresh_token

    wallet = "GxKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRrJosgAsU"

    # Register + login
    await client.post(
        "/api/v1/auth/register",
        json={"email": "refresh@example.com", "solana_wallet_address": wallet, "role": "investor"},
    )
    login_resp = await client.post(
        "/api/v1/auth/login/wallet",
        json={"wallet_address": wallet, "network": "solana"},
    )
    login_data = login_resp.json()
    user_email = "refresh@example.com"

    # Create refresh token
    refresh_token = create_refresh_token(subject=user_email)

    resp = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data


# ---------------------------------------------------------------------------
# 6. Logout & Token Revocation
# ---------------------------------------------------------------------------

async def test_logout_revokes_token(
    client: AsyncClient, db_session: AsyncSession
):
    """DELETE /auth/logout → refresh token revoked, re-use → 401."""
    from app.core.security import create_refresh_token

    wallet = "HxKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRrJosgAsU"

    # Register + login
    await client.post(
        "/api/v1/auth/register",
        json={"email": "logout@example.com", "solana_wallet_address": wallet, "role": "investor"},
    )
    login_resp = await client.post(
        "/api/v1/auth/login/wallet",
        json={"wallet_address": wallet, "network": "solana"},
    )

    refresh_token = create_refresh_token(subject="logout@example.com")

    # Logout
    logout_resp = await client.request(
        "DELETE",
        "/api/v1/auth/logout",
        content=json.dumps({"refresh_token": refresh_token}),
        headers={"Content-Type": "application/json"},
    )
    assert logout_resp.status_code == 200

    # Try to use revoked token
    refresh_resp = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert refresh_resp.status_code == 401


# ---------------------------------------------------------------------------
# 7. Password Reset
# ---------------------------------------------------------------------------

async def test_password_reset_user_not_found(client: AsyncClient):
    """PUT /auth/password-reset → 404 if user doesn't exist."""
    resp = await client.put(
        "/api/v1/auth/password-reset",
        json={"email": "nobody@example.com", "new_password": "NewPass123!"},
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# 8. Get Current User (/me)
# ---------------------------------------------------------------------------

async def test_me_returns_current_user(
    client: AsyncClient, db_session: AsyncSession
):
    """GET /auth/me → 200, user data returned."""
    wallet = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRrJosgAsU"
    email = "me@example.com"

    # Register
    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "solana_wallet_address": wallet, "role": "investor"},
    )
    assert reg_resp.status_code == 201, reg_resp.json()

    # Login
    login_resp = await client.post(
        "/api/v1/auth/login/wallet",
        json={"wallet_address": wallet, "network": "solana"},
    )
    assert login_resp.status_code == 200, f"Login failed: {login_resp.json()}"
    tokens = login_resp.json()
    assert "access_token" in tokens, f"Unexpected login response: {tokens}"
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    resp = await client.get("/api/v1/auth/me", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["role"] == "investor"


async def test_me_unauthorized(client: AsyncClient):
    """GET /auth/me → 401 without token."""
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401
