"""Integration tests for complete user flows.

These tests cover端到端 scenarios:
1. Investor registration via wallet → login → profile update
2. Issuer flow: investor → upgrade to issuer via OTP → verification documents
3. IP claim management: create, list, review
4. Role-based access control
5. Audit trail verification
"""

from __future__ import annotations

import io
import json
import uuid
from unittest.mock import patch, MagicMock, AsyncMock

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import (
    User,
    UserRole,
    UserStatus,
    Profile,
    VerificationCase,
    VerificationStatus,
    WalletLink,
)
from app.models.ip_claim import IpClaim, IpClaimStatus, IpReviewDecision
from app.models.common import AuditLog


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create_access_token_for_user(email: str, role: str = "user") -> str:
    """Create a JWT access token for testing."""
    from datetime import timedelta
    from app.core.security import create_token
    return create_token(
        subject=email,
        token_type="access",
        expires_delta=timedelta(minutes=30),
        extra_claims={"role": role},
    )


async def _create_admin_user(db_session: AsyncSession) -> User:
    """Create an admin user directly in DB."""
    from app.services.user_service import UserService

    user = User(
        email=f"admin-{uuid.uuid4().hex[:6]}@example.com",
        password_hash=UserService.hash_password("AdminPass123!"),
        role=UserRole.admin.value,
        status=UserStatus.active.value,
    )
    db_session.add(user)
    await db_session.flush()
    await db_session.refresh(user)
    return user


def _make_investor_wallet(wallet_address: str = None) -> dict:
    return {
        "email": f"investor-{uuid.uuid4().hex[:6]}@example.com",
        "solana_wallet_address": wallet_address or "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRrJosgAsU",
    }


def _make_issuer_payload(email: str = None) -> dict:
    return {
        "email": email or f"issuer-{uuid.uuid4().hex[:6]}@example.com",
        "solana_wallet_address": "8xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRrJosgAsU",
    }


# ---------------------------------------------------------------------------
# 1. Investor Flow: Register → Wallet Login → Profile Update
# ---------------------------------------------------------------------------


async def test_full_investor_flow(
    client: AsyncClient, db_session: AsyncSession
):
    """Investor registers via wallet, logs in, updates profile."""
    from app.services.user_service import UserService

    wallet = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRrJosgAsU"
    email = f"investor-flow-{uuid.uuid4().hex[:6]}@example.com"

    # Step 1: Register investor
    resp = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "solana_wallet_address": wallet},
    )
    assert resp.status_code == 201

    # Verify user created
    user = await UserService.get_by_email(db_session, email)
    assert user is not None
    assert user.status == UserStatus.active.value
    assert user.role == UserRole.investor.value

    # Step 2: Login via wallet
    login_resp = await client.post(
        "/api/v1/auth/login/wallet",
        json={"wallet_address": wallet, "network": "solana"},
    )
    assert login_resp.status_code == 200
    tokens = login_resp.json()
    assert "access_token" in tokens
    assert tokens["role"] == "investor"

    # Step 3: Update profile
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    resp = await client.put(
        "/api/v1/users/profile",
        headers=headers,
        json={"legal_name": "Investor Name", "country": "US"},
    )
    assert resp.status_code == 200
    assert resp.json()["legal_name"] == "Investor Name"


# ---------------------------------------------------------------------------
# 2. Issuer Flow: Register → Upgrade to Isser → Verification Documents
# ---------------------------------------------------------------------------


async def test_full_issuer_flow_with_verification(
    client: AsyncClient, db_session: AsyncSession, mock_redis_client
):
    """Investor registers, upgrades to issuer via OTP, submits verification docs."""
    from app.services.user_service import UserService

    wallet = "9xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRrJosgAsU"
    email = f"issuer-flow-{uuid.uuid4().hex[:6]}@example.com"

    # Step 1: Register investor
    resp = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "solana_wallet_address": wallet},
    )
    assert resp.status_code == 201

    # Step 2: Login
    login_resp = await client.post(
        "/api/v1/auth/login/wallet",
        json={"wallet_address": wallet, "network": "solana"},
    )
    assert login_resp.status_code == 200
    tokens = login_resp.json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    # Step 3: Upgrade to issuer (triggers OTP)
    with patch("app.services.otp_service.send_email_otp"):
        resp = await client.post(
            "/api/v1/users/upgrade-to-issuer",
            headers=headers,
        )
    assert resp.status_code == 200

    # Step 4: Verify OTP (mock Redis)
    from app.services.otp_service import _hash_otp
    import time
    import json as json_mod

    # Simulate OTP was generated and stored
    code = "123456"
    key = f"otp:issuer_upgrade:{email.lower()}"
    payload = json_mod.dumps({
        "otp_hash": _hash_otp(code),
        "attempts_left": 5,
        "expires_at": time.time() + 300,
    })
    mock_redis_client.get = AsyncMock(return_value=payload)

    verify_resp = await client.post(
        "/api/v1/auth/otp-verify",
        json={"identifier": email, "code": code, "purpose": "issuer_upgrade"},
    )
    assert verify_resp.status_code == 200
    assert verify_resp.json()["role_changed"] is True

    # Step 5: Submit verification documents
    files = {
        "id_document": ("id.png", io.BytesIO(b"fake-id-data"), "image/png"),
        "selfie": ("selfie.png", io.BytesIO(b"fake-selfie-data"), "image/png"),
    }
    resp = await client.post(
        "/api/v1/users/verification/documents",
        headers=headers,
        files=files,
        data={"user_address": "123 Main St"},
    )
    assert resp.status_code == 201
    assert resp.json()["status"] == VerificationStatus.pending.value


# ---------------------------------------------------------------------------
# 3. IP Claim Management Flow
# ---------------------------------------------------------------------------


async def test_ip_claim_management_flow(
    client: AsyncClient, db_session: AsyncSession
):
    """Issuer creates claim via DB, admin reviews it."""
    from app.services.user_service import UserService
    from app.services.ip_claim_service import IpClaimService
    from app.schemas.ip_claim import IpClaimReviewRequest

    # Create issuer
    wallet = "AxKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRrJosgAsU"
    email = f"claim-flow-{uuid.uuid4().hex[:6]}@example.com"
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "solana_wallet_address": wallet},
    )
    issuer = await UserService.get_by_email(db_session, email)
    # Manually upgrade to issuer
    issuer.role = UserRole.issuer.value
    await db_session.flush()

    # Login
    login_resp = await client.post(
        "/api/v1/auth/login/wallet",
        json={"wallet_address": wallet, "network": "solana"},
    )
    tokens = login_resp.json()
    issuer_headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    # Create claim in DB
    claim = IpClaim(
        issuer_user_id=issuer.id,
        patent_number="US5555555",
        patent_title="Flow Test Patent",
        claimed_owner_name="Issuer Corp",
        status=IpClaimStatus.submitted.value,
    )
    db_session.add(claim)
    await db_session.flush()
    await db_session.refresh(claim)
    claim_id = str(claim.id)

    # Admin reviews
    admin = await _create_admin_user(db_session)
    from app.core.security import create_token
    from datetime import timedelta
    admin_token = create_token(
        subject=admin.email, token_type="access",
        expires_delta=timedelta(minutes=30),
        extra_claims={"role": "admin"},
    )
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    resp = await client.post(
        f"/api/v1/ip-claims/{claim_id}/review",
        headers=admin_headers,
        json={"decision": "approve", "notes": "Approved"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == IpClaimStatus.approved.value


# ---------------------------------------------------------------------------
# 4. Role-Based Access Control
# ---------------------------------------------------------------------------


async def test_rbac_prevents_unauthorized_actions(
    client: AsyncClient, db_session: AsyncSession
):
    """Regular users cannot perform admin actions."""
    from app.services.user_service import UserService

    # Create investor
    wallet = "BxKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRrJosgAsU"
    email = f"rbac-{uuid.uuid4().hex[:6]}@example.com"
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "solana_wallet_address": wallet},
    )
    investor = await UserService.get_by_email(db_session, email)

    login_resp = await client.post(
        "/api/v1/auth/login/wallet",
        json={"wallet_address": wallet, "network": "solana"},
    )
    tokens = login_resp.json()
    investor_headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    # Investor tries to review claim → 403
    fake_claim_id = uuid.uuid4()
    resp = await client.post(
        f"/api/v1/ip-claims/{fake_claim_id}/review",
        headers=investor_headers,
        json={"decision": "approve", "notes": "Unauthorized"},
    )
    assert resp.status_code in (403, 404)


# ---------------------------------------------------------------------------
# 5. Audit Trail
# ---------------------------------------------------------------------------


async def test_full_flow_creates_complete_audit_trail(
    client: AsyncClient, db_session: AsyncSession
):
    """Verify audit log captures critical actions."""
    from app.services.user_service import UserService

    wallet = "CxKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRrJosgAsU"
    email = f"audit-flow-{uuid.uuid4().hex[:6]}@example.com"

    # Register
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "solana_wallet_address": wallet},
    )
    user = await UserService.get_by_email(db_session, email)

    # Login
    await client.post(
        "/api/v1/auth/login/wallet",
        json={"wallet_address": wallet, "network": "solana"},
    )

    # Check audit logs
    audit_stmt = select(AuditLog).where(
        AuditLog.entity_id == str(user.id)
    )
    logs = (await db_session.execute(audit_stmt)).scalars().all()

    actions = [log.action for log in logs]
    assert "auth.register_investor" in actions
    assert "auth.wallet_login" in actions


# ---------------------------------------------------------------------------
# 6. Admin Workflow: Multiple Claims Review
# ---------------------------------------------------------------------------


async def test_admin_review_multiple_ip_claims(
    client: AsyncClient, db_session: AsyncSession
):
    """Admin reviews multiple IP claims."""
    from app.services.user_service import UserService
    from app.core.security import create_token
    from datetime import timedelta
    from app.schemas.ip_claim import IpClaimReviewRequest
    from app.services.ip_claim_service import IpClaimService

    # Create admin
    admin = await _create_admin_user(db_session)
    admin_token = create_token(
        subject=admin.email, token_type="access",
        expires_delta=timedelta(minutes=30),
        extra_claims={"role": "admin"},
    )
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Create issuer and claims
    claim_ids = []
    for i in range(3):
        email = f"issuer{i}@example.com"
        # Use valid base58 wallets (no 0, O, I, l)
        wallets = ["EaKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRrJosgAsA",
                   "EbKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRrJosgAsB",
                   "EcKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRrJosgAsC"]
        wallet = wallets[i]
        await client.post(
            "/api/v1/auth/register",
            json={"email": email, "solana_wallet_address": wallet},
        )
        # Get user directly from DB since email is unique
        from sqlalchemy import select as sa_select
        result = await db_session.execute(
            sa_select(User).where(User.email == email.lower())
        )
        issuer = result.scalar_one_or_none()
        assert issuer is not None, f"Issuer {email} not found after registration"
        issuer.role = UserRole.issuer.value
        await db_session.flush()

        claim = IpClaim(
            issuer_user_id=issuer.id,
            patent_number=f"US{i}00000{i}",
            patent_title=f"Claim {i}",
            claimed_owner_name=f"Company {i}",
            status=IpClaimStatus.submitted.value,
        )
        db_session.add(claim)
        await db_session.flush()
        claim_ids.append(str(claim.id))

    # Admin approves first 2, rejects last
    for idx, claim_id in enumerate(claim_ids):
        decision = "approve" if idx < 2 else "reject"
        resp = await client.post(
            f"/api/v1/ip-claims/{claim_id}/review",
            headers=admin_headers,
            json={"decision": decision, "notes": f"Review {idx}"},
        )
        assert resp.status_code == 200
        expected_status = IpClaimStatus.approved.value if decision == "approve" else IpClaimStatus.rejected.value
        assert resp.json()["status"] == expected_status
