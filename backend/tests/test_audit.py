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


# ---------------------------------------------------------------------------
# 1. AuditLog Insert on Critical Actions
# ---------------------------------------------------------------------------

async def test_audit_log_on_user_login(client: AsyncClient, make_user, db_session):
    """Login → AuditLog row with action='auth.login_success'."""
    user = await make_user(role="user", status="active")

    await client.post(
        "/api/v1/auth/login",
        json={"email": user.email, "password": "TestPassword123!"},
    )

    stmt = select(AuditLog).where(AuditLog.action == "auth.login_success")
    logs = (await db_session.execute(stmt)).scalars().all()
    assert len(logs) >= 1

    log = logs[0]
    assert log.entity_type == "user"
    assert log.entity_id == str(user.id)


async def test_audit_log_on_user_register(client: AsyncClient, db_session):
    """Register → AuditLog row with action='auth.register_patient' or 'auth.register_investor'."""
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "audituser@example.com",
            "password": "SecurePass123!",
            "role": "user",
            "legal_name": "Audit User",
            "country": "US",
        },
    )
    assert resp.status_code == 201

    stmt = select(AuditLog).where(
        AuditLog.action.in_(["auth.register_patient", "auth.register_investor"])
    )
    logs = (await db_session.execute(stmt)).scalars().all()
    assert len(logs) >= 1


async def test_audit_log_on_ip_claim_create(client: AsyncClient, make_user, auth_headers, db_session):
    """Create IP claim → AuditLog row with action='ip_claim.created'."""
    user = await make_user(role="issuer", status="active")
    headers = auth_headers(user)

    await client.post(
        "/api/v1/ip-claims",
        headers=headers,
        json={
            "patent_number": "US1111111",
            "patent_title": "Audit Test Patent",
            "claimed_owner_name": "Audit Corp",
        },
    )

    stmt = select(AuditLog).where(AuditLog.action == "ip_claim.created")
    logs = (await db_session.execute(stmt)).scalars().all()
    assert len(logs) >= 1


async def test_audit_log_on_ip_claim_review(
    client: AsyncClient, make_user, auth_headers, db_session
):
    """Review IP claim → AuditLog row with action='ip_claim.reviewed'."""
    issuer = await make_user(role="issuer", status="active")
    admin = await make_user(role="admin", status="active")

    # Create claim
    create_resp = await client.post(
        "/api/v1/ip-claims",
        headers=auth_headers(issuer),
        json={
            "patent_number": "US2222222",
            "patent_title": "Review Audit Patent",
            "claimed_owner_name": "Review Corp",
        },
    )
    claim_id = create_resp.json()["id"]

    # Review
    await client.post(
        f"/api/v1/ip-claims/{claim_id}/review",
        headers=auth_headers(admin),
        json={"decision": "approve", "notes": "Approved for audit test"},
    )

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
    "email",  # In some contexts, email is PII
    "phone",
    "address",
]


async def test_audit_log_no_pii_in_login_payload(client: AsyncClient, make_user, db_session):
    """AuditLog payload on login must not contain PII (password, tokens, etc.)."""
    user = await make_user(role="user", status="active")

    await client.post(
        "/api/v1/auth/login",
        json={"email": user.email, "password": "TestPassword123!"},
    )

    stmt = select(AuditLog).where(AuditLog.action == "auth.login_success")
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
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": "pii-test@example.com",
            "password": "SecurePass123!",
            "role": "user",
            "legal_name": "PII User",
            "country": "US",
        },
    )

    stmt = select(AuditLog).where(
        AuditLog.action.in_(["auth.register_patient", "auth.register_investor"])
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
    issuer = await make_user(role="issuer", status="active", email="issuer-pii@example.com")
    admin = await make_user(role="admin", status="active", email="admin-pii@example.com")

    create_resp = await client.post(
        "/api/v1/ip-claims",
        headers=auth_headers(issuer),
        json={
            "patent_number": "US3333333",
            "patent_title": "PII Review Patent",
            "claimed_owner_name": "PII Corp",
        },
    )
    claim_id = create_resp.json()["id"]

    await client.post(
        f"/api/v1/ip-claims/{claim_id}/review",
        headers=auth_headers(admin),
        json={"decision": "approve", "notes": "Clean review"},
    )

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
    user = await make_user(role="user", status="active", email="reset-audit@example.com")

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

    # Perform actions
    user = await make_user(role="issuer", status="active", email="count-test@example.com")
    headers = auth_headers(user)

    await client.post(
        "/api/v1/ip-claims",
        headers=headers,
        json={
            "patent_number": "US4444444",
            "patent_title": "Count Test Patent",
            "claimed_owner_name": "Count Corp",
        },
    )

    # Check count increased
    count_stmt = select(func.count()).select_from(AuditLog)
    new_count = (await db_session.execute(count_stmt)).scalar() or 0
    assert new_count > initial_count
