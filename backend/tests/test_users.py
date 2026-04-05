"""
Tests for /api/v1/users/* endpoints:
profile CRUD, document upload, verification status, role guard.
"""
from __future__ import annotations

import io
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole, UserStatus, VerificationCase, VerificationStatus
from app.models.common import AuditLog


# ---------------------------------------------------------------------------
# 1. Profile CRUD
# ---------------------------------------------------------------------------

async def test_get_my_profile_empty(client: AsyncClient, make_user, auth_headers):
    """GET /users/profile → 200, empty profile if none exists."""
    user = await make_user(role="user", status="active")
    headers = auth_headers(user)

    resp = await client.get("/api/v1/users/profile", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["legal_name"] is None
    assert data["country"] is None


async def test_update_my_profile(client: AsyncClient, make_user, auth_headers, db_session):
    """PUT /users/profile → profile created/updated."""
    user = await make_user(role="user", status="active")
    headers = auth_headers(user)

    resp = await client.put(
        "/api/v1/users/profile",
        headers=headers,
        json={"legal_name": "John Doe", "country": "US"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["legal_name"] == "John Doe"
    assert data["country"] == "US"

    # Verify persistence
    resp = await client.get("/api/v1/users/profile", headers=headers)
    assert resp.json()["legal_name"] == "John Doe"


async def test_update_profile_partial(client: AsyncClient, make_user, auth_headers):
    """PUT /users/profile → partial update (only country)."""
    user = await make_user(role="user", status="active")
    headers = auth_headers(user)

    # First set both fields
    await client.put(
        "/api/v1/users/profile",
        headers=headers,
        json={"legal_name": "John", "country": "US"},
    )

    # Partial update
    resp = await client.put(
        "/api/v1/users/profile",
        headers=headers,
        json={"country": "GB"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["country"] == "GB"


async def test_profile_requires_auth(client: AsyncClient):
    """GET /users/profile → 401 without token."""
    resp = await client.get("/api/v1/users/profile")
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# 2. Verification Documents Upload
# ---------------------------------------------------------------------------

async def test_submit_verification_documents(client: AsyncClient, make_user, auth_headers):
    """POST /users/verification/documents → 201, verification case created."""
    user = await make_user(role="user", status="active")
    headers = auth_headers(user)

    files = {
        "id_document": ("id.png", io.BytesIO(b"fake-id-data"), "image/png"),
        "selfie": ("selfie.png", io.BytesIO(b"fake-selfie-data"), "image/png"),
    }
    data = {"user_address": "123 Main St"}

    resp = await client.post(
        "/api/v1/users/verification/documents",
        headers=headers,
        files=files,
        data=data,
    )
    assert resp.status_code == 201
    vc = resp.json()
    assert vc["status"] == VerificationStatus.pending.value
    assert vc["user_address"] == "123 Main St"


async def test_submit_verification_documents_wrong_role(client: AsyncClient, make_user, auth_headers):
    """POST /users/verification/documents → 400 for non-submitter role."""
    user = await make_user(role="investor", status="active")
    headers = auth_headers(user)

    files = {
        "id_document": ("id.png", io.BytesIO(b"data"), "image/png"),
        "selfie": ("selfie.png", io.BytesIO(b"data"), "image/png"),
    }
    resp = await client.post(
        "/api/v1/users/verification/documents",
        headers=headers,
        files=files,
        data={"user_address": "123 Main St"},
    )
    assert resp.status_code == 400


async def test_verification_status(client: AsyncClient, make_user, auth_headers, db_session):
    """GET /users/verification/status → returns latest case."""
    user = await make_user(role="user", status="active")
    headers = auth_headers(user)

    # No case yet → 404
    resp = await client.get("/api/v1/users/verification/status", headers=headers)
    assert resp.status_code == 404

    # Create case
    files = {
        "id_document": ("id.png", io.BytesIO(b"data"), "image/png"),
        "selfie": ("selfie.png", io.BytesIO(b"data"), "image/png"),
    }
    await client.post(
        "/api/v1/users/verification/documents",
        headers=headers,
        files=files,
        data={"user_address": "123 Main St"},
    )

    # Check status
    resp = await client.get("/api/v1/users/verification/status", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == VerificationStatus.pending.value


# ---------------------------------------------------------------------------
# 3. Verification Review (Role Guard)
# ---------------------------------------------------------------------------

async def test_review_verification_approve(
    client: AsyncClient, make_user, auth_headers, db_session
):
    """POST /users/verification/review/{id} → approved, user status updated."""
    submitter = await make_user(role="user", status="active")
    admin = await make_user(role="admin", status="active")

    # Create verification case
    sub_headers = auth_headers(submitter)
    files = {
        "id_document": ("id.png", io.BytesIO(b"data"), "image/png"),
        "selfie": ("selfie.png", io.BytesIO(b"data"), "image/png"),
    }
    resp = await client.post(
        "/api/v1/users/verification/documents",
        headers=sub_headers,
        files=files,
        data={"user_address": "123 Main St"},
    )
    case_id = resp.json()["id"]

    # Admin reviews
    admin_headers = auth_headers(admin)
    resp = await client.post(
        f"/api/v1/users/verification/review/{case_id}",
        headers=admin_headers,
        data={"decision": "approved", "notes": "Looks good"},
    )
    assert resp.status_code == 200
    vc = resp.json()
    assert vc["status"] == VerificationStatus.approved.value

    # User status changed to active
    await db_session.refresh(submitter)
    assert submitter.status == UserStatus.active.value


async def test_review_verification_reject(
    client: AsyncClient, make_user, auth_headers, db_session
):
    """POST /users/verification/review/{id} → rejected, user status updated."""
    submitter = await make_user(role="user", status="active")
    admin = await make_user(role="admin", status="active")

    sub_headers = auth_headers(submitter)
    files = {
        "id_document": ("id.png", io.BytesIO(b"data"), "image/png"),
        "selfie": ("selfie.png", io.BytesIO(b"data"), "image/png"),
    }
    resp = await client.post(
        "/api/v1/users/verification/documents",
        headers=sub_headers,
        files=files,
        data={"user_address": "123 Main St"},
    )
    case_id = resp.json()["id"]

    admin_headers = auth_headers(admin)
    resp = await client.post(
        f"/api/v1/users/verification/review/{case_id}",
        headers=admin_headers,
        data={"decision": "rejected", "notes": "Documents unclear"},
    )
    assert resp.status_code == 200
    vc = resp.json()
    assert vc["status"] == VerificationStatus.rejected.value

    await db_session.refresh(submitter)
    assert submitter.status == UserStatus.rejected.value


async def test_review_verification_forbidden_for_regular_user(
    client: AsyncClient, make_user, auth_headers, db_session
):
    """POST /users/verification/review/{id} → 403 for non-admin user."""
    submitter = await make_user(role="user", status="active")
    regular = await make_user(role="user", status="active")

    sub_headers = auth_headers(submitter)
    files = {
        "id_document": ("id.png", io.BytesIO(b"data"), "image/png"),
        "selfie": ("selfie.png", io.BytesIO(b"data"), "image/png"),
    }
    resp = await client.post(
        "/api/v1/users/verification/documents",
        headers=sub_headers,
        files=files,
        data={"user_address": "123 Main St"},
    )
    case_id = resp.json()["id"]

    regular_headers = auth_headers(regular)
    resp = await client.post(
        f"/api/v1/users/verification/review/{case_id}",
        headers=regular_headers,
        data={"decision": "approved", "notes": ""},
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# 4. Duplicate Verification Case
# ---------------------------------------------------------------------------

async def test_cannot_submit_verification_when_pending(
    client: AsyncClient, make_user, auth_headers, db_session
):
    """POST /users/verification/documents → 400 if case already pending."""
    user = await make_user(role="user", status="active")
    headers = auth_headers(user)

    files = {
        "id_document": ("id.png", io.BytesIO(b"data"), "image/png"),
        "selfie": ("selfie.png", io.BytesIO(b"data"), "image/png"),
    }
    # First submission
    await client.post(
        "/api/v1/users/verification/documents",
        headers=headers,
        files=files,
        data={"user_address": "123 Main St"},
    )

    # Second submission → 400
    resp = await client.post(
        "/api/v1/users/verification/documents",
        headers=headers,
        files=files,
        data={"user_address": "456 Other St"},
    )
    assert resp.status_code == 400
