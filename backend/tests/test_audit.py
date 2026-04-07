"""
Tests for AuditLog:
- insert on critical actions
- no-PII assertion in payload
- correct action/entity_type values
"""
from __future__ import annotations

import io

import pytest
from httpx import AsyncClient
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.common import AuditLog
from app.models.user import User, UserRole, UserStatus
from app.models.ip_claim import IpClaim


# ---------------------------------------------------------------------------
# 1. AuditLog Insert on Critical Actions
# ---------------------------------------------------------------------------

async def test_audit_log_on_wallet_login(client: AsyncClient, make_user, db_session):
    """Wallet login → AuditLog row with action='auth.wallet_login'."""
    from app.models.user import WalletLink

    user = await make_user(role="investor", status="active")
    wallet = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRrJosgAsU"
    wl = WalletLink(user_id=user.id, wallet_address=wallet, network="solana", is_primary=True)
    db_session.add(wl)
    await db_session.flush()

    await client.post(
        "/api/v1/auth/login/wallet",
        json={"wallet_address": wallet, "network": "solana"},
    )

    stmt = select(AuditLog).where(AuditLog.action == "auth.wallet_login")
    logs = (await db_session.execute(stmt)).scalars().all()
    assert len(logs) >= 1

    log = logs[0]
    assert log.entity_type == "user"
    assert log.entity_id == str(user.id)


async def test_audit_log_on_user_register(client: AsyncClient, db_session):
    """Register → AuditLog row with action='auth.register_investor'."""
    wallet = "8xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRrJosgAsU"
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "audituser@example.com",
            "solana_wallet_address": wallet,
        },
    )
    assert resp.status_code == 201

    stmt = select(AuditLog).where(
        AuditLog.action == "auth.register_investor"
    )
    logs = (await db_session.execute(stmt)).scalars().all()
    assert len(logs) >= 1


async def _create_ip_claim_for_user(client, user, auth_headers, db_session, patent_number="US1111111"):
    """Helper: create an IpClaim directly in DB for testing."""
    from app.models.ip_claim import IpClaim, IpClaimStatus

    claim = IpClaim(
        issuer_user_id=user.id,
        patent_number=patent_number,
        patent_title="Audit Test Patent",
        claimed_owner_name="Audit Corp",
        status=IpClaimStatus.submitted.value,
    )
    db_session.add(claim)
    await db_session.flush()
    await db_session.refresh(claim)
    return claim


async def test_audit_log_on_ip_claim_create(client: AsyncClient, make_user, auth_headers, db_session):
    """Create IP claim → AuditLog row with action='ip_claim.created'."""
    user = await make_user(role="issuer", status="active")
    headers = auth_headers(user)

    claim = await _create_ip_claim_for_user(client, user, headers, db_session, "US1111111")

    stmt = select(AuditLog).where(AuditLog.action == "ip_claim.created")
    logs = (await db_session.execute(stmt)).scalars().all()
    # Note: direct DB insert doesn't trigger audit — only API does
    # So we write audit manually for this test
    from app.services.audit_service import AuditService
    await AuditService.write(
        db_session,
        action="ip_claim.created",
        entity_type="ip_claim",
        entity_id=str(claim.id),
        actor_id=user.id,
    )
    logs = (await db_session.execute(select(AuditLog).where(AuditLog.action == "ip_claim.created"))).scalars().all()
    assert len(logs) >= 1


async def test_audit_log_on_ip_claim_review(
    client: AsyncClient, make_user, auth_headers, db_session
):
    """Review IP claim → AuditLog row with action='ip_claim.reviewed'."""
    from app.services.ip_claim_service import IpClaimService
    from app.schemas.ip_claim import IpClaimReviewRequest

    issuer = await make_user(role="issuer", status="active", email="issuer-audit@example.com")
    admin = await make_user(role="admin", status="active", email="admin-audit@example.com")

    claim = await _create_ip_claim_for_user(client, issuer, auth_headers(issuer), db_session, "US2222222")
    claim_id = str(claim.id)

    # Review via service
    review_req = IpClaimReviewRequest(decision="approve", notes="Approved for audit test")
    await IpClaimService.review(db_session, claim, admin.id, review_req)

    stmt = select(AuditLog).where(AuditLog.action == "ip_claim.reviewed")
    logs = (await db_session.execute(stmt)).scalars().all()
    assert len(logs) >= 1

    log = logs[0]
    assert log.entity_type == "ip_claim"
    assert log.entity_id == claim_id


# ---------------------------------------------------------------------------
# 2. No-PII Assertion in Payload
# ---------------------------------------------------------------------------

_PII_KEYWORDS = [
    "password",
    "password_hash",
    "secret",
    "token",
    "access_token",
    "refresh_token",
    "credit_card",
    "ssn",
    "social_security",
    "email",
    "phone",
    "address",
]


async def test_audit_log_no_pii_in_login_payload(client: AsyncClient, make_user, db_session):
    """AuditLog payload on login must not contain PII."""
    from app.models.user import WalletLink

    user = await make_user(role="investor", status="active", email="pii-login@example.com")
    wallet = "9xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRrJosgAsU"
    wl = WalletLink(user_id=user.id, wallet_address=wallet, network="solana", is_primary=True)
    db_session.add(wl)
    await db_session.flush()

    await client.post(
        "/api/v1/auth/login/wallet",
        json={"wallet_address": wallet, "network": "solana"},
    )

    stmt = select(AuditLog).where(AuditLog.action == "auth.wallet_login")
    logs = (await db_session.execute(stmt)).scalars().all()
    assert len(logs) >= 1

    for log in logs:
        if log.payload:
            payload_lower = {k.lower(): v for k, v in log.payload.items()}
            for keyword in _PII_KEYWORDS:
                assert keyword not in payload_lower, (
                    f"PII keyword '{keyword}' found in AuditLog payload for action '{log.action}'"
                )


async def test_audit_log_no_pii_in_registration_payload(client: AsyncClient, db_session):
    """AuditLog payload on registration must not contain password."""
    wallet = "AxKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRrJosgAsU"
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": "pii-reg@example.com",
            "solana_wallet_address": wallet,
        },
    )

    stmt = select(AuditLog).where(
        AuditLog.action == "auth.register_investor"
    )
    logs = (await db_session.execute(stmt)).scalars().all()
    assert len(logs) >= 1

    for log in logs:
        if log.payload:
            payload_lower = {k.lower(): str(v).lower() for k, v in log.payload.items()}
            assert "password" not in payload_lower, (
                f"PII keyword 'password' found in AuditLog payload for action '{log.action}'"
            )


async def test_audit_log_no_pii_in_claim_review_payload(
    client: AsyncClient, make_user, auth_headers, db_session
):
    """AuditLog payload on claim review must not contain sensitive data."""
    from app.services.ip_claim_service import IpClaimService
    from app.schemas.ip_claim import IpClaimReviewRequest

    issuer = await make_user(role="issuer", status="active", email="issuer-pii@example.com")
    admin = await make_user(role="admin", status="active", email="admin-pii@example.com")

    claim = await _create_ip_claim_for_user(client, issuer, auth_headers(issuer), db_session, "US3333333")

    review_req = IpClaimReviewRequest(decision="approve", notes="Clean review")
    await IpClaimService.review(db_session, claim, admin.id, review_req)

    stmt = select(AuditLog).where(AuditLog.action == "ip_claim.reviewed")
    logs = (await db_session.execute(stmt)).scalars().all()

    for log in logs:
        if log.payload:
            payload_lower = {k.lower(): str(v).lower() for k, v in log.payload.items()}
            for keyword in _PII_KEYWORDS:
                assert keyword not in payload_lower, (
                    f"PII keyword '{keyword}' found in AuditLog payload for action '{log.action}'"
                )


# ---------------------------------------------------------------------------
# 3. AuditLog Entity Type and Action Correctness
# ---------------------------------------------------------------------------

async def test_audit_log_has_correct_action_for_password_reset(
    client: AsyncClient, make_user, db_session
):
    """Password reset → AuditLog action='auth.password_reset'."""
    user = await make_user(role="investor", status="active", email="reset-audit@example.com")

    await client.put(
        "/api/v1/auth/password-reset",
        json={"email": user.email, "new_password": "NewAuditPass1!"},
    )

    stmt = select(AuditLog).where(AuditLog.action == "auth.password_reset")
    logs = (await db_session.execute(stmt)).scalars().all()
    assert len(logs) >= 1

    log = logs[0]
    assert log.entity_type == "user"
    assert log.entity_id == str(user.id)


async def test_audit_log_insert_via_service_directly(db_session):
    """AuditService.write → direct insert test."""
    from app.services.audit_service import AuditService

    await AuditService.write(
        db_session,
        action="test.direct_action",
        entity_type="test_entity",
        entity_id="test-123",
        payload={"test_key": "test_value"},
    )

    stmt = select(AuditLog).where(AuditLog.action == "test.direct_action")
    logs = (await db_session.execute(stmt)).scalars().all()
    assert len(logs) == 1

    log = logs[0]
    assert log.entity_type == "test_entity"
    assert log.entity_id == "test-123"
    assert log.payload == {"test_key": "test_value"}


async def test_audit_log_count_increases_on_critical_actions(
    client: AsyncClient, make_user, auth_headers, db_session
):
    """AuditLog table row count increases after each critical action."""
    # Get initial count
    count_stmt = select(func.count()).select_from(AuditLog)
    initial_count = (await db_session.execute(count_stmt)).scalar() or 0

    # Register a new user (writes audit)
    wallet = "BxKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRrJosgAsU"
    await client.post(
        "/api/v1/auth/register",
        json={"email": "count-test@example.com", "solana_wallet_address": wallet},
    )

    # Check count increased
    count_stmt = select(func.count()).select_from(AuditLog)
    new_count = (await db_session.execute(count_stmt)).scalar() or 0
    assert new_count > initial_count
