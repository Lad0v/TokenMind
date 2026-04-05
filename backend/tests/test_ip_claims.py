"""
Tests for /api/v1/ip-claims/* endpoints:
create, list, document upload, review state machine.
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

def _make_claim_payload(patent_number: str = "US1234567") -> dict:
    return {
        "patent_number": patent_number,
        "patent_title": "Test Patent",
        "claimed_owner_name": "Acme Corp",
        "description": "A test patent",
        "jurisdiction": "US",
    }


# ---------------------------------------------------------------------------
# 1. Create IP Claim
# ---------------------------------------------------------------------------

async def test_create_ip_claim_success(client: AsyncClient, make_user, auth_headers, db_session):
    """POST /ip-claims → 200, claim created with status=submitted."""
    user = await make_user(role="issuer", status="active")
    headers = auth_headers(user)
    payload = _make_claim_payload()

    resp = await client.post("/api/v1/ip-claims", headers=headers, json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["patent_number"] == payload["patent_number"]
    assert data["status"] == IpClaimStatus.submitted.value
    assert data["issuer_user_id"] == str(user.id)


async def test_create_ip_claim_with_precheck_snapshot(
    client: AsyncClient, make_user, auth_headers, db_session
):
    """POST /ip-claims with precheck_snapshot → prechecked=True."""
    user = await make_user(role="issuer", status="active")
    headers = auth_headers(user)
    payload = _make_claim_payload()
    payload["precheck_snapshot"] = {
        "status": "found",
        "source_id": "uspto:1234567",
        "metadata": {"title": "Test"},
    }

    resp = await client.post("/api/v1/ip-claims", headers=headers, json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["prechecked"] is True
    assert data["precheck_status"] == "found"


async def test_create_ip_claim_unauthorized(client: AsyncClient):
    """POST /ip-claims → 401 without auth."""
    resp = await client.post("/api/v1/ip-claims", json=_make_claim_payload())
    assert resp.status_code in (401, 403)


# ---------------------------------------------------------------------------
# 2. List IP Claims
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

    # Create 2 claims
    await client.post("/api/v1/ip-claims", headers=headers, json=_make_claim_payload("US111"))
    await client.post("/api/v1/ip-claims", headers=headers, json=_make_claim_payload("US222"))

    resp = await client.get("/api/v1/ip-claims?status=submitted", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2


# ---------------------------------------------------------------------------
# 3. Get Single Claim + Access Control
# ---------------------------------------------------------------------------

async def test_get_ip_claim_owner_can_see(client: AsyncClient, make_user, auth_headers, db_session):
    """GET /ip-claims/{id} → 200 for owner."""
    user = await make_user(role="issuer", status="active")
    headers = auth_headers(user)

    create_resp = await client.post("/api/v1/ip-claims", headers=headers, json=_make_claim_payload())
    claim_id = create_resp.json()["id"]

    resp = await client.get(f"/api/v1/ip-claims/{claim_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == claim_id


async def test_get_ip_claim_forbidden_for_other_user(
    client: AsyncClient, make_user, auth_headers, db_session
):
    """GET /ip-claims/{id} → 403 for non-owner without admin role."""
    owner = await make_user(role="issuer", status="active", email="owner@example.com")
    other = await make_user(role="user", status="active", email="other@example.com")

    owner_headers = auth_headers(owner)
    create_resp = await client.post("/api/v1/ip-claims", headers=owner_headers, json=_make_claim_payload())
    claim_id = create_resp.json()["id"]

    other_headers = auth_headers(other)
    resp = await client.get(f"/api/v1/ip-claims/{claim_id}", headers=other_headers)
    assert resp.status_code == 403


async def test_get_ip_claim_admin_can_see_all(
    client: AsyncClient, make_user, auth_headers, db_session
):
    """GET /ip-claims/{id} → 200 for admin even if not owner."""
    owner = await make_user(role="issuer", status="active", email="owner2@example.com")
    admin = await make_user(role="admin", status="active")

    owner_headers = auth_headers(owner)
    create_resp = await client.post("/api/v1/ip-claims", headers=owner_headers, json=_make_claim_payload())
    claim_id = create_resp.json()["id"]

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
# 4. Document Upload
# ---------------------------------------------------------------------------

async def test_upload_document_success(client: AsyncClient, make_user, auth_headers, db_session):
    """POST /ip-claims/{id}/documents → 200, document record created."""
    user = await make_user(role="issuer", status="active")
    headers = auth_headers(user)

    create_resp = await client.post("/api/v1/ip-claims", headers=headers, json=_make_claim_payload())
    claim_id = create_resp.json()["id"]

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
    other = await make_user(role="user", status="active", email="other3@example.com")

    owner_headers = auth_headers(owner)
    create_resp = await client.post("/api/v1/ip-claims", headers=owner_headers, json=_make_claim_payload())
    claim_id = create_resp.json()["id"]

    other_headers = auth_headers(other)
    files = {"file": ("doc.pdf", io.BytesIO(b"data"), "application/pdf")}
    resp = await client.post(
        f"/api/v1/ip-claims/{claim_id}/documents",
        headers=other_headers,
        files=files,
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# 5. Review State Machine
# ---------------------------------------------------------------------------

async def test_review_claim_approve(client: AsyncClient, make_user, auth_headers, db_session):
    """POST /ip-claims/{id}/review with decision=approve → status=approved."""
    issuer = await make_user(role="issuer", status="active")
    admin = await make_user(role="admin", status="active")

    # Create claim
    create_resp = await client.post(
        "/api/v1/ip-claims",
        headers=auth_headers(issuer),
        json=_make_claim_payload(),
    )
    claim_id = create_resp.json()["id"]

    # Review
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

    create_resp = await client.post(
        "/api/v1/ip-claims",
        headers=auth_headers(issuer),
        json=_make_claim_payload(),
    )
    claim_id = create_resp.json()["id"]

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

    create_resp = await client.post(
        "/api/v1/ip-claims",
        headers=auth_headers(issuer),
        json=_make_claim_payload(),
    )
    claim_id = create_resp.json()["id"]

    admin_headers = auth_headers(admin)
    resp = await client.post(
        f"/api/v1/ip-claims/{claim_id}/review",
        headers=admin_headers,
        json={"decision": "request_more_data", "notes": "Need more details"},
    )
    assert resp.status_code == 200
    # request_more_data sets status back to submitted per service logic
    assert resp.json()["status"] == IpClaimStatus.submitted.value


async def test_review_forbidden_for_non_admin(client: AsyncClient, make_user, auth_headers, db_session):
    """POST /ip-claims/{id}/review → 403 for non-admin/compliance_officer."""
    issuer = await make_user(role="issuer", status="active")
    other_user = await make_user(role="user", status="active", email="other5@example.com")

    create_resp = await client.post(
        "/api/v1/ip-claims",
        headers=auth_headers(issuer),
        json=_make_claim_payload(),
    )
    claim_id = create_resp.json()["id"]

    other_headers = auth_headers(other_user)
    resp = await client.post(
        f"/api/v1/ip-claims/{claim_id}/review",
        headers=other_headers,
        json={"decision": "approve", "notes": ""},
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# 6. Audit Trail
# ---------------------------------------------------------------------------

async def test_create_claim_writes_audit(client: AsyncClient, make_user, auth_headers, db_session):
    """POST /ip-claims → AuditLog with action='ip_claim.created'."""
    user = await make_user(role="issuer", status="active")
    headers = auth_headers(user)

    resp = await client.post("/api/v1/ip-claims", headers=headers, json=_make_claim_payload())
    claim_id = resp.json()["id"]

    stmt = select(AuditLog).where(
        AuditLog.action == "ip_claim.created",
        AuditLog.entity_id == claim_id,
    )
    logs = (await db_session.execute(stmt)).scalars().all()
    assert len(logs) >= 1


async def test_review_claim_writes_audit(client: AsyncClient, make_user, auth_headers, db_session):
    """POST /ip-claims/{id}/review → AuditLog with action='ip_claim.reviewed'."""
    issuer = await make_user(role="issuer", status="active")
    admin = await make_user(role="admin", status="active")

    create_resp = await client.post(
        "/api/v1/ip-claims",
        headers=auth_headers(issuer),
        json=_make_claim_payload(),
    )
    claim_id = create_resp.json()["id"]

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
