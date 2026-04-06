"""
Tests for /api/v1/ip-claims/* endpoints:
list, get, document upload, review state machine.

Note: IP claim creation is now done via /api/v1/auth/submit-patent
(includes OTP flow). Tests create claims directly in DB for isolation.
"""
from __future__ import annotations

import io
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ip_claim import IpClaim, IpClaimStatus, IpDocument, IpReview, IpReviewDecision
from app.models.common import AuditLog


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _create_claim_in_db(db_session, user_id, patent_number="US1234567"):
    """Helper: create an IpClaim directly in DB."""
    claim = IpClaim(
        issuer_user_id=user_id,
        patent_number=patent_number,
        patent_title="Test Patent",
        claimed_owner_name="Acme Corp",
        status=IpClaimStatus.submitted.value,
    )
    db_session.add(claim)
    await db_session.flush()
    await db_session.refresh(claim)
    return claim


# ---------------------------------------------------------------------------
# 1. List IP Claims
# ---------------------------------------------------------------------------

async def test_list_ipclaims_empty(client: AsyncClient, make_user, auth_headers):
    """GET /ip-claims → empty list."""
    user = await make_user(role="issuer", status="active")
    headers = auth_headers(user)

    resp = await client.get("/api/v1/ip-claims", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 0
    assert data["items"] == []


async def test_list_ipclaims_with_filter(client: AsyncClient, make_user, auth_headers, db_session):
    """GET /ip-claims?status=submitted → filtered list."""
    user = await make_user(role="issuer", status="active")
    headers = auth_headers(user)

    # Create 2 claims directly in DB
    await _create_claim_in_db(db_session, user.id, "US111")
    await _create_claim_in_db(db_session, user.id, "US222")

    resp = await client.get("/api/v1/ip-claims", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2


# ---------------------------------------------------------------------------
# 2. Get Single Claim + Access Control
# ---------------------------------------------------------------------------

async def test_get_ip_claim_owner_can_see(client: AsyncClient, make_user, auth_headers, db_session):
    """GET /ip-claims/{id} → 200 for owner."""
    user = await make_user(role="issuer", status="active")
    headers = auth_headers(user)

    claim = await _create_claim_in_db(db_session, user.id)
    claim_id = str(claim.id)

    resp = await client.get(f"/api/v1/ip-claims/{claim_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == claim_id


async def test_get_ip_claim_forbidden_for_other_user(
    client: AsyncClient, make_user, auth_headers, db_session
):
    """GET /ip-claims/{id} → 403 for non-owner without admin role."""
    owner = await make_user(role="issuer", status="active", email="owner@example.com")
    other = await make_user(role="investor", status="active", email="other@example.com")

    claim = await _create_claim_in_db(db_session, owner.id)
    claim_id = str(claim.id)

    other_headers = auth_headers(other)
    resp = await client.get(f"/api/v1/ip-claims/{claim_id}", headers=other_headers)
    assert resp.status_code == 403


async def test_get_ip_claim_admin_can_see_all(
    client: AsyncClient, make_user, auth_headers, db_session
):
    """GET /ip-claims/{id} → 200 for admin even if not owner."""
    owner = await make_user(role="issuer", status="active", email="owner2@example.com")
    admin = await make_user(role="admin", status="active")

    claim = await _create_claim_in_db(db_session, owner.id)
    claim_id = str(claim.id)

    admin_headers = auth_headers(admin)
    resp = await client.get(f"/api/v1/ip-claims/{claim_id}", headers=admin_headers)
    assert resp.status_code == 200


async def test_get_ip_claim_not_found(client: AsyncClient, make_user, auth_headers):
    """GET /ip-claims/{id} → 404 for non-existent claim."""
    user = await make_user(role="admin", status="active")
    headers = auth_headers(user)

    resp = await client.get(f"/api/v1/ip-claims/{uuid.uuid4()}", headers=headers)
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# 3. Document Upload
# ---------------------------------------------------------------------------

async def test_upload_document_success(client: AsyncClient, make_user, auth_headers, db_session):
    """POST /ip-claims/{id}/documents → 200, document record created."""
    user = await make_user(role="issuer", status="active")
    headers = auth_headers(user)

    claim = await _create_claim_in_db(db_session, user.id)
    claim_id = str(claim.id)

    files = {"file": ("spec.pdf", io.BytesIO(b"pdf-data"), "application/pdf")}
    resp = await client.post(
        f"/api/v1/ip-claims/{claim_id}/documents",
        headers=headers,
        files=files,
        data={"doc_type": "specification"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "file_url" in data
    assert data["doc_type"] == "specification"


async def test_upload_document_forbidden_for_non_owner(
    client: AsyncClient, make_user, auth_headers, db_session
):
    """POST /ip-claims/{id}/documents → 403 for non-owner."""
    owner = await make_user(role="issuer", status="active", email="owner3@example.com")
    other = await make_user(role="investor", status="active", email="other3@example.com")

    claim = await _create_claim_in_db(db_session, owner.id)
    claim_id = str(claim.id)

    other_headers = auth_headers(other)
    files = {"file": ("doc.pdf", io.BytesIO(b"data"), "application/pdf")}
    resp = await client.post(
        f"/api/v1/ip-claims/{claim_id}/documents",
        headers=other_headers,
        files=files,
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# 4. Review State Machine
# ---------------------------------------------------------------------------

async def test_review_claim_approve(client: AsyncClient, make_user, auth_headers, db_session):
    """POST /ip-claims/{id}/review with decision=approve → status=approved."""
    issuer = await make_user(role="issuer", status="active")
    admin = await make_user(role="admin", status="active")

    claim = await _create_claim_in_db(db_session, issuer.id)
    claim_id = str(claim.id)

    admin_headers = auth_headers(admin)
    resp = await client.post(
        f"/api/v1/ip-claims/{claim_id}/review",
        headers=admin_headers,
        json={"decision": "approve", "notes": "Valid claim"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == IpClaimStatus.approved.value


async def test_review_claim_reject(client: AsyncClient, make_user, auth_headers, db_session):
    """POST /ip-claims/{id}/review with decision=reject → status=rejected."""
    issuer = await make_user(role="issuer", status="active")
    admin = await make_user(role="admin", status="active")

    claim = await _create_claim_in_db(db_session, issuer.id)
    claim_id = str(claim.id)

    admin_headers = auth_headers(admin)
    resp = await client.post(
        f"/api/v1/ip-claims/{claim_id}/review",
        headers=admin_headers,
        json={"decision": "reject", "notes": "Invalid"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == IpClaimStatus.rejected.value


async def test_review_claim_request_more_data(
    client: AsyncClient, make_user, auth_headers, db_session
):
    """POST /ip-claims/{id}/review with decision=request_more_data → status=submitted."""
    issuer = await make_user(role="issuer", status="active")
    admin = await make_user(role="admin", status="active")

    claim = await _create_claim_in_db(db_session, issuer.id)
    claim_id = str(claim.id)

    admin_headers = auth_headers(admin)
    resp = await client.post(
        f"/api/v1/ip-claims/{claim_id}/review",
        headers=admin_headers,
        json={"decision": "request_more_data", "notes": "Need more details"},
    )
    assert resp.status_code == 200
    # request_more_data sets status back to submitted
    assert resp.json()["status"] == IpClaimStatus.submitted.value


async def test_review_forbidden_for_non_admin(client: AsyncClient, make_user, auth_headers, db_session):
    """POST /ip-claims/{id}/review → 403 for non-admin."""
    issuer = await make_user(role="issuer", status="active")
    other_user = await make_user(role="investor", status="active", email="other5@example.com")

    claim = await _create_claim_in_db(db_session, issuer.id)
    claim_id = str(claim.id)

    other_headers = auth_headers(other_user)
    resp = await client.post(
        f"/api/v1/ip-claims/{claim_id}/review",
        headers=other_headers,
        json={"decision": "approve", "notes": ""},
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# 5. Audit Trail
# ---------------------------------------------------------------------------

async def test_review_claim_writes_audit(client: AsyncClient, make_user, auth_headers, db_session):
    """POST /ip-claims/{id}/review → AuditLog with action='ip_claim.reviewed'."""
    issuer = await make_user(role="issuer", status="active")
    admin = await make_user(role="admin", status="active")

    claim = await _create_claim_in_db(db_session, issuer.id)
    claim_id = str(claim.id)

    admin_headers = auth_headers(admin)
    await client.post(
        f"/api/v1/ip-claims/{claim_id}/review",
        headers=admin_headers,
        json={"decision": "approve", "notes": "OK"},
    )

    stmt = select(AuditLog).where(
        AuditLog.action == "ip_claim.reviewed",
        AuditLog.entity_id == claim_id,
    )
    logs = (await db_session.execute(stmt)).scalars().all()
    assert len(logs) >= 1
