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
    user = await make_user(role="investor", status="active")
    headers = auth_headers(user)

    resp = await client.get("/api/v1/users/profile", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["legal_name"] is None
    assert data["country"] is None


async def test_update_my_profile(client: AsyncClient, make_user, auth_headers, db_session):
    """PUT /users/profile → profile created/updated."""
    user = await make_user(role="investor", status="active")
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
    user = await make_user(role="investor", status="active")
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
    # Verification is only for issuers (patent submitters)
    user = await make_user(role="issuer", status="active")
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
    """POST /users/verification/documents → 400 for non-issuer role."""
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
    user = await make_user(role="issuer", status="active")
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
# 3. Verification Case States
# ---------------------------------------------------------------------------

async def test_cannot_submit_verification_when_pending(
    client: AsyncClient, make_user, auth_headers, db_session
):
    """POST /users/verification/documents → 400 if case already pending."""
    user = await make_user(role="issuer", status="active")
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


async def test_verification_case_rejected_can_resubmit(
    client: AsyncClient, make_user, auth_headers, db_session
):
    """After rejection, user can resubmit verification documents."""
    user = await make_user(role="issuer", status="active")

    # Create rejected verification case directly in DB
    vc = VerificationCase(
        user_id=user.id,
        status=VerificationStatus.rejected.value,
        user_address="Old Address",
        id_document_url="old_id.png",
        selfie_url="old_selfie.png",
    )
    db_session.add(vc)
    await db_session.flush()

    headers = auth_headers(user)
    files = {
        "id_document": ("new_id.png", io.BytesIO(b"new-data"), "image/png"),
        "selfie": ("new_selfie.png", io.BytesIO(b"new-data"), "image/png"),
    }
    resp = await client.post(
        "/api/v1/users/verification/documents",
        headers=headers,
        files=files,
        data={"user_address": "New Address"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == VerificationStatus.pending.value
    assert data["user_address"] == "New Address"


async def test_verification_case_approved_cannot_resubmit(
    client: AsyncClient, make_user, auth_headers, db_session
):
    """After approval, user cannot resubmit."""
    user = await make_user(role="issuer", status="active")

    vc = VerificationCase(
        user_id=user.id,
        status=VerificationStatus.approved.value,
        user_address="Approved Address",
    )
    db_session.add(vc)
    await db_session.flush()

    headers = auth_headers(user)
    files = {
        "id_document": ("id.png", io.BytesIO(b"data"), "image/png"),
        "selfie": ("selfie.png", io.BytesIO(b"data"), "image/png"),
    }
    resp = await client.post(
        "/api/v1/users/verification/documents",
        headers=headers,
        files=files,
        data={"user_address": "New Address"},
    )
    assert resp.status_code == 400
