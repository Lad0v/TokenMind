"""
Tests for /api/v1/auth/* endpoints:
register, OTP flow, login, refresh, logout, password reset.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import OTPCode, User, UserRole, UserStatus
from app.models.common import AuditLog
from app.services.user_service import UserService


# ---------------------------------------------------------------------------
# 1. OTP Registration Flow (3 steps)
# ---------------------------------------------------------------------------

async def test_register_patient_sends_otp(client: AsyncClient, db_session: AsyncSession):
    """Step 1: POST /auth/register → user created, OTP generated, status pending_otp."""
    payload = {
        "email": "patient@example.com",
        "password": "SecurePass123!",
        "role": "user",
        "legal_name": "John Doe",
        "country": "US",
    }
    resp = await client.post("/api/v1/auth/register", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["user_id"] is not None
    assert "OTP sent" in data["message"]

    # Verify user in DB
    user = await UserService.get_by_email(db_session, payload["email"])
    assert user is not None
    assert user.status == UserStatus.pending_otp.value
    assert user.role == UserRole.user.value

    # Verify OTP record exists
    stmt = select(OTPCode).where(OTPCode.user_id == user.id)
    otp_rows = (await db_session.execute(stmt)).scalars().all()
    assert len(otp_rows) == 1


async def test_otp_send_success(client: AsyncClient, db_session: AsyncSession, make_user):
    """Step 2 (optional): POST /auth/otp/send → new OTP generated."""
    user = await make_user(role="user", status="pending_otp")

    resp = await client.post("/api/v1/auth/otp/send", json={"email": user.email})
    assert resp.status_code == 200
    assert "OTP code sent" in resp.json()["message"]

    stmt = select(OTPCode).where(OTPCode.user_id == user.id, OTPCode.is_used == False)
    otp_rows = (await db_session.execute(stmt)).scalars().all()
    assert len(otp_rows) >= 1


async def test_otp_send_user_already_active(client: AsyncClient, make_user):
    """POST /auth/otp/send → 400 if user already active."""
    user = await make_user(role="user", status="active")

    resp = await client.post("/api/v1/auth/otp/send", json={"email": user.email})
    assert resp.status_code == 400


async def test_otp_verify_completes_registration(
    client: AsyncClient, db_session: AsyncSession
):
    """Step 3: POST /auth/otp/verify → user activated, tokens returned."""
    # Register user first (this creates OTP)
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": "otp-verify@example.com",
            "password": "SecurePass123!",
            "role": "user",
            "legal_name": "OTP User",
            "country": "US",
        },
    )

    # Get the OTP code from DB
    from app.services.user_service import UserService
    user = await UserService.get_by_email(db_session, "otp-verify@example.com")
    assert user is not None

    stmt = select(OTPCode).where(OTPCode.user_id == user.id, OTPCode.is_used == False)
    otp = (await db_session.execute(stmt)).scalars().first()
    assert otp is not None

    resp = await client.post(
        "/api/v1/auth/otp/verify",
        json={"email": user.email, "code": otp.code},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["verified"] is True
    assert data["access_token"] is not None
    assert data["refresh_token"] is not None

    # User status changed to active
    await db_session.refresh(user)
    assert user.status == UserStatus.active.value


async def test_otp_verify_invalid_code(client: AsyncClient, make_user):
    """POST /auth/otp/verify → 400 on wrong code."""
    user = await make_user(role="user", status="pending_otp")

    resp = await client.post(
        "/api/v1/auth/otp/verify",
        json={"email": user.email, "code": "000000"},
    )
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# 2. Investor Direct-Active Flow
# ---------------------------------------------------------------------------

async def test_register_investor_no_otp(client: AsyncClient, db_session: AsyncSession):
    """Investor registration → active immediately, no OTP, wallet created."""
    payload = {
        "email": "investor@example.com",
        "password": "InvestPass123!",
        "role": "investor",
        "wallet_address": "0xABCDEF1234567890",
    }
    resp = await client.post("/api/v1/auth/register", json=payload)
    assert resp.status_code == 201

    user = await UserService.get_by_email(db_session, payload["email"])
    assert user is not None
    assert user.status == UserStatus.active.value
    assert user.role == UserRole.investor.value

    # WalletLink created
    from app.models.user import WalletLink
    stmt = select(WalletLink).where(WalletLink.user_id == user.id)
    wallets = (await db_session.execute(stmt)).scalars().all()
    assert len(wallets) == 1


async def test_register_investor_missing_wallet(client: AsyncClient):
    """Investor registration without wallet → 400."""
    payload = {
        "email": "investor2@example.com",
        "password": "InvestPass123!",
        "role": "investor",
    }
    resp = await client.post("/api/v1/auth/register", json=payload)
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# 3. Login
# ---------------------------------------------------------------------------

async def test_login_success(client: AsyncClient, make_user):
    """POST /auth/login → 200, tokens returned."""
    password = "SecurePass123!"
    user = await make_user(role="user", status="active", password=password)

    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": user.email, "password": password},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["access_token"] is not None
    assert data["refresh_token"] is not None
    assert data["role"] == user.role


async def test_login_wrong_password(client: AsyncClient, make_user):
    """POST /auth/login → 401 on wrong password."""
    user = await make_user(role="user", status="active", password="CorrectPass1!")

    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": user.email, "password": "WrongPass1!"},
    )
    assert resp.status_code == 401


async def test_login_pending_otp_user(client: AsyncClient, make_user):
    """POST /auth/login → 403 if user hasn't completed OTP."""
    user = await make_user(role="user", status="pending_otp")

    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": user.email, "password": "TestPassword123!"},
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# 4. Refresh Token
# ---------------------------------------------------------------------------

async def test_refresh_token_success(client: AsyncClient, make_user):
    """POST /auth/refresh → 200, new access token."""
    user = await make_user(role="user", status="active")

    # Login to get refresh token
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": user.email, "password": "TestPassword123!"},
    )
    refresh_token = login_resp.json()["refresh_token"]

    resp = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert resp.status_code == 200


async def test_refresh_token_missing(client: AsyncClient):
    """POST /auth/refresh → 400 if refresh_token not provided."""
    resp = await client.post("/api/v1/auth/refresh", json={})
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# 5. Logout & Token Revocation
# ---------------------------------------------------------------------------

async def test_logout_revokes_token(client: AsyncClient, db_session: AsyncSession, make_user):
    """DELETE /auth/logout → refresh token revoked, re-use → 401."""
    user = await make_user(role="user", status="active")

    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": user.email, "password": "TestPassword123!"},
    )
    refresh_token = login_resp.json()["refresh_token"]

    # Logout
    resp = await client.request("DELETE", "/api/v1/auth/logout", json={"refresh_token": refresh_token})
    assert resp.status_code == 200

    # Try to refresh with revoked token → 401
    resp = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# 6. Password Reset
# ---------------------------------------------------------------------------

async def test_password_reset_success(client: AsyncClient, db_session: AsyncSession, make_user):
    """PUT /auth/password-reset → password updated."""
    user = await make_user(role="user", status="active", password="OldPass123!")

    resp = await client.put(
        "/api/v1/auth/password-reset",
        json={"email": user.email, "new_password": "NewPass123!"},
    )
    assert resp.status_code == 200

    # Verify new password works
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": user.email, "password": "NewPass123!"},
    )
    assert resp.status_code == 200

    # Old password no longer works
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": user.email, "password": "OldPass123!"},
    )
    assert resp.status_code == 401


async def test_password_reset_user_not_found(client: AsyncClient):
    """PUT /auth/password-reset → 404 if user doesn't exist."""
    resp = await client.put(
        "/api/v1/auth/password-reset",
        json={"email": "nobody@example.com", "new_password": "NewPass123!"},
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# 7. Get Current User (/me)
# ---------------------------------------------------------------------------

async def test_me_returns_current_user(client: AsyncClient, make_user, auth_headers):
    """GET /auth/me → 200, user data returned."""
    user = await make_user(role="user", status="active")
    headers = auth_headers(user)

    resp = await client.get("/api/v1/auth/me", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == user.email
    assert data["role"] == user.role


async def test_me_unauthorized(client: AsyncClient):
    """GET /auth/me → 401 without token."""
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# 8. Duplicate Registration
# ---------------------------------------------------------------------------

async def test_register_duplicate_email(client: AsyncClient, make_user):
    """POST /auth/register → 400 if email already exists."""
    await make_user(role="user", status="active", email="dup@example.com")

    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "dup@example.com",
            "password": "SecurePass123!",
            "role": "user",
            "legal_name": "Jane",
            "country": "US",
        },
    )
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# 9. Audit Logging on Auth Actions
# ---------------------------------------------------------------------------

async def test_login_creates_audit_log(client: AsyncClient, db_session: AsyncSession, make_user):
    """Successful login → AuditLog row with action='auth.login_success'."""
    user = await make_user(role="user", status="active")

    await client.post(
        "/api/v1/auth/login",
        json={"email": user.email, "password": "TestPassword123!"},
    )

    stmt = select(AuditLog).where(
        AuditLog.action == "auth.login_success",
        AuditLog.entity_id == str(user.id),
    )
    logs = (await db_session.execute(stmt)).scalars().all()
    assert len(logs) >= 1
