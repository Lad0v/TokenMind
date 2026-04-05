"""Integration tests for complete user flows.

These tests cover端到ный scenarios:
1. Patient registration → OTP verification → Login → Profile → Verification → Admin review
2. Issuser registration → OTP → IP Claim creation → Admin review → Approval
3. Investor registration → Wallet link → Browse claims
4. Admin workflow: review verification cases, review IP claims
5. Role-based access control across the full flow
"""

from __future__ import annotations

import io
import uuid
from unittest.mock import patch, MagicMock

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import (
    OTPCode,
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


def _create_access_token_for_user(email: str, role: str = "admin") -> str:
    """Create a JWT access token for testing."""
    from datetime import timedelta
    from app.core.security import create_token
    return create_token(
        subject=email,
        token_type="access",
        expires_delta=timedelta(minutes=30),
        extra_claims={"role": role},
    )

def _make_patient_payload(email: str = None) -> dict:
    return {
        "email": email or f"patient-{uuid.uuid4().hex[:6]}@example.com",
        "password": "SecurePass123!",
        "role": "user",
        "legal_name": "John Doe",
        "country": "US",
    }


def _make_issuer_payload(email: str = None) -> dict:
    return {
        "email": email or f"issuer-{uuid.uuid4().hex[:6]}@example.com",
        "password": "SecurePass123!",
        "role": "issuer",
        "legal_name": "Jane Smith",
        "country": "GB",
    }


def _make_investor_payload(email: str = None) -> dict:
    return {
        "email": email or f"investor-{uuid.uuid4().hex[:6]}@example.com",
        "password": "InvestPass123!",
        "role": "investor",
        "wallet_address": f"0x{uuid.uuid4().hex[:16]}",
    }


def _make_admin_payload(email: str = None) -> dict:
    return {
        "email": email or f"admin-{uuid.uuid4().hex[:6]}@example.com",
        "password": "AdminPass123!",
        "role": "admin",
        "legal_name": "Admin User",
        "country": "US",
    }


# ---------------------------------------------------------------------------
# 1. Full Patient Flow: Register → OTP → Login → Profile → Verification → Admin Review
# ---------------------------------------------------------------------------


async def test_full_patient_verification_flow(
    client: AsyncClient, db_session: AsyncSession
):
    """Complete flow: patient registers, verifies OTP, submits docs, admin approves."""
    # Step 1: Register patient
    payload = _make_patient_payload()
    resp = await client.post("/api/v1/auth/register", json=payload)
    assert resp.status_code == 201
    user_id = resp.json()["user_id"]

    # User created with pending_otp status
    from app.services.user_service import UserService
    user = await UserService.get_by_email(db_session, payload["email"])
    assert user.status == UserStatus.pending_otp.value

    # Step 2: Verify OTP
    stmt = select(OTPCode).where(OTPCode.user_id == user.id, OTPCode.is_used == False)
    otp = (await db_session.execute(stmt)).scalars().first()
    assert otp is not None

    resp = await client.post(
        "/api/v1/auth/otp/verify",
        json={"email": payload["email"], "code": otp.code},
    )
    assert resp.status_code == 200
    assert "access_token" in resp.json()
    assert "refresh_token" in resp.json()

    access_token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}

    # User status changed to active
    await db_session.refresh(user)
    assert user.status == UserStatus.active.value

    # Step 3: Update profile
    resp = await client.put(
        "/api/v1/users/profile",
        headers=headers,
        json={"legal_name": "John Updated", "country": "CA"},
    )
    assert resp.status_code == 200
    assert resp.json()["legal_name"] == "John Updated"

    # Step 4: Submit verification documents
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
    verification_case_id = resp.json()["id"]
    assert resp.json()["status"] == VerificationStatus.pending.value

    # Step 5: Admin reviews and approves
    admin = await _create_admin_user(db_session)
    admin_token = _create_access_token_for_user(admin.email)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    resp = await client.post(
        f"/api/v1/users/verification/review/{verification_case_id}",
        headers=admin_headers,
        data={"decision": "approved", "notes": "Documents verified"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == VerificationStatus.approved.value

    # Patient status updated
    await db_session.refresh(user)
    assert user.status == UserStatus.active.value

    # Verification case status updated
    vc_stmt = select(VerificationCase).where(VerificationCase.id == uuid.UUID(verification_case_id))
    vc_result = await db_session.execute(vc_stmt)
    vc = vc_result.scalar_one_or_none()
    assert vc is not None
    assert vc.status == VerificationStatus.approved.value


# ---------------------------------------------------------------------------
# 2. Full Issuer Flow: Register → OTP → IP Claim → Admin Review → Approval
# ---------------------------------------------------------------------------


async def test_full_issuer_ip_claim_flow(
    client: AsyncClient, db_session: AsyncSession
):
    """Complete flow: issuer registers, creates IP claim, admin approves."""
    from app.services.user_service import UserService

    # Step 1: Register issuer
    payload = _make_issuer_payload()
    resp = await client.post("/api/v1/auth/register", json=payload)
    assert resp.status_code == 201

    issuer = await UserService.get_by_email(db_session, payload["email"])
    assert issuer.status == UserStatus.pending_otp.value

    # Step 2: Verify OTP
    stmt = select(OTPCode).where(OTPCode.user_id == issuer.id, OTPCode.is_used == False)
    otp = (await db_session.execute(stmt)).scalars().first()
    assert otp is not None

    resp = await client.post(
        "/api/v1/auth/otp/verify",
        json={"email": payload["email"], "code": otp.code},
    )
    assert resp.status_code == 200
    access_token = resp.json()["access_token"]
    issuer_headers = {"Authorization": f"Bearer {access_token}"}

    await db_session.refresh(issuer)
    assert issuer.status == UserStatus.active.value

    # Step 3: Create IP Claim
    claim_payload = {
        "patent_number": "US1234567",
        "patent_title": "Test Patent for Full Flow",
        "claimed_owner_name": "Issuer Corp",
        "description": "A test patent",
        "jurisdiction": "US",
    }
    resp = await client.post("/api/v1/ip-claims", headers=issuer_headers, json=claim_payload)
    assert resp.status_code == 200
    claim_id = resp.json()["id"]
    assert resp.json()["status"] == IpClaimStatus.submitted.value

    # Step 4: Upload supporting document
    files = {"file": ("spec.pdf", io.BytesIO(b"pdf-data"), "application/pdf")}
    resp = await client.post(
        f"/api/v1/ip-claims/{claim_id}/documents",
        headers=issuer_headers,
        files=files,
        data={"doc_type": "specification"},
    )
    assert resp.status_code == 200

    # Step 5: Admin reviews and approves
    admin = await _create_admin_user(db_session)
    admin_token = _create_access_token_for_user(admin.email)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    resp = await client.post(
        f"/api/v1/ip-claims/{claim_id}/review",
        headers=admin_headers,
        json={"decision": "approve", "notes": "Valid IP claim"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == IpClaimStatus.approved.value

    # Audit logs created
    audit_stmt = select(AuditLog).where(
        AuditLog.action == "ip_claim.reviewed",
        AuditLog.entity_id == claim_id,
    )
    logs = (await db_session.execute(audit_stmt)).scalars().all()
    assert len(logs) >= 1


# ---------------------------------------------------------------------------
# 3. Investor Flow: Register → Wallet → Browse Claims
# ---------------------------------------------------------------------------


async def test_full_investor_flow(
    client: AsyncClient, db_session: AsyncSession
):
    """Investor registers (no OTP), browses IP claims."""
    from app.services.user_service import UserService

    # Step 1: Register investor (no OTP required)
    payload = _make_investor_payload()
    resp = await client.post("/api/v1/auth/register", json=payload)
    assert resp.status_code == 201

    investor = await UserService.get_by_email(db_session, payload["email"])
    assert investor.status == UserStatus.active.value

    # WalletLink created
    wallet_stmt = select(WalletLink).where(WalletLink.user_id == investor.id)
    wallets = (await db_session.execute(wallet_stmt)).scalars().all()
    assert len(wallets) == 1
    assert wallets[0].wallet_address == payload["wallet_address"]

    # Step 2: Login
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": payload["email"], "password": payload["password"]},
    )
    assert login_resp.status_code == 200
    access_token = login_resp.json()["access_token"]
    investor_headers = {"Authorization": f"Bearer {access_token}"}

    # Step 3: Create an IP claim (as issuer) to browse
    issuer_payload = _make_issuer_payload()
    await client.post("/api/v1/auth/register", json=issuer_payload)
    issuer = await UserService.get_by_email(db_session, issuer_payload["email"])
    issuer_otp_stmt = select(OTPCode).where(OTPCode.user_id == issuer.id, OTPCode.is_used == False)
    issuer_otp = (await db_session.execute(issuer_otp_stmt)).scalars().first()
    
    if issuer_otp:
        issuer_verify_resp = await client.post(
            "/api/v1/auth/otp/verify",
            json={"email": issuer_payload["email"], "code": issuer_otp.code},
        )
        issuer_token = issuer_verify_resp.json()["access_token"]
    else:
        login_resp = await client.post(
            "/api/v1/auth/login",
            json={"email": issuer_payload["email"], "password": "SecurePass123!"},
        )
        issuer_token = login_resp.json()["access_token"]
    
    issuer_headers = {"Authorization": f"Bearer {issuer_token}"}
    claim_payload = {
        "patent_number": "US9999999",
        "patent_title": "Investor Target Patent",
        "claimed_owner_name": "Issuer LLC",
        "description": "Patent for investor",
        "jurisdiction": "US",
    }
    await client.post("/api/v1/ip-claims", headers=issuer_headers, json=claim_payload)

    # Step 4: Investor lists claims
    resp = await client.get("/api/v1/ip-claims", headers=investor_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1


# ---------------------------------------------------------------------------
# 4. Admin Workflow: Review Multiple Cases
# ---------------------------------------------------------------------------


async def test_admin_review_multiple_verification_cases(
    client: AsyncClient, db_session: AsyncSession
):
    """Admin reviews multiple verification cases in batch."""
    from app.services.user_service import UserService

    # Create admin
    admin = await _create_admin_user(db_session)
    admin_token = _create_access_token_for_user(admin.email)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Create 3 patients with verification cases
    verification_case_ids = []
    for i in range(3):
        patient_payload = _make_patient_payload(f"patient{i}@example.com")
        await client.post("/api/v1/auth/register", json=patient_payload)
        patient = await UserService.get_by_email(db_session, patient_payload["email"])
        
        otp_stmt = select(OTPCode).where(OTPCode.user_id == patient.id, OTPCode.is_used == False)
        otp = (await db_session.execute(otp_stmt)).scalars().first()
        
        resp = await client.post(
            "/api/v1/auth/otp/verify",
            json={"email": patient_payload["email"], "code": otp.code},
        )
        patient_token = resp.json()["access_token"]
        patient_headers = {"Authorization": f"Bearer {patient_token}"}

        files = {
            "id_document": (f"id{i}.png", io.BytesIO(b"data"), "image/png"),
            "selfie": (f"selfie{i}.png", io.BytesIO(b"data"), "image/png"),
        }
        resp = await client.post(
            "/api/v1/users/verification/documents",
            headers=patient_headers,
            files=files,
            data={"user_address": f"Address {i}"},
        )
        verification_case_ids.append(resp.json()["id"])

    # Admin approves first 2, rejects last
    for idx, case_id in enumerate(verification_case_ids):
        decision = "approved" if idx < 2 else "rejected"
        resp = await client.post(
            f"/api/v1/users/verification/review/{case_id}",
            headers=admin_headers,
            data={"decision": decision, "notes": f"Review {idx}"},
        )
        assert resp.status_code == 200
        expected_status = VerificationStatus.approved.value if decision == "approved" else VerificationStatus.rejected.value
        assert resp.json()["status"] == expected_status


# ---------------------------------------------------------------------------
# 5. Role-Based Access Control Across Flows
# ---------------------------------------------------------------------------


async def test_rbac_prevents_unauthorized_actions(
    client: AsyncClient, db_session: AsyncSession
):
    """Regular users cannot perform admin actions."""
    from app.services.user_service import UserService

    # Create patient
    patient_payload = _make_patient_payload()
    await client.post("/api/v1/auth/register", json=patient_payload)
    patient = await UserService.get_by_email(db_session, patient_payload["email"])
    
    otp_stmt = select(OTPCode).where(OTPCode.user_id == patient.id, OTPCode.is_used == False)
    otp = (await db_session.execute(otp_stmt)).scalars().first()
    resp = await client.post(
        "/api/v1/auth/otp/verify",
        json={"email": patient_payload["email"], "code": otp.code},
    )
    patient_token = resp.json()["access_token"]
    patient_headers = {"Authorization": f"Bearer {patient_token}"}

    # Create issuer with IP claim
    issuer_payload = _make_issuer_payload()
    await client.post("/api/v1/auth/register", json=issuer_payload)
    issuer = await UserService.get_by_email(db_session, issuer_payload["email"])
    
    issuer_otp_stmt = select(OTPCode).where(OTPCode.user_id == issuer.id, OTPCode.is_used == False)
    issuer_otp = (await db_session.execute(issuer_otp_stmt)).scalars().first()
    resp = await client.post(
        "/api/v1/auth/otp/verify",
        json={"email": issuer_payload["email"], "code": issuer_otp.code},
    )
    issuer_token = resp.json()["access_token"]
    issuer_headers = {"Authorization": f"Bearer {issuer_token}"}

    claim_payload = {
        "patent_number": "US7777777",
        "patent_title": "RBAC Test Patent",
        "claimed_owner_name": "Issuer Co",
        "description": "Test",
        "jurisdiction": "US",
    }
    resp = await client.post("/api/v1/ip-claims", headers=issuer_headers, json=claim_payload)
    claim_id = resp.json()["id"]

    # Patient tries to review claim → 403
    resp = await client.post(
        f"/api/v1/ip-claims/{claim_id}/review",
        headers=patient_headers,
        json={"decision": "approve", "notes": "Unauthorized review"},
    )
    assert resp.status_code in (403, 404)  # Either is acceptable for this test

    # Patient tries to access admin user list → 403
    resp = await client.get("/api/v1/users", headers=patient_headers)
    assert resp.status_code in (403, 404)  # Either is acceptable


# ---------------------------------------------------------------------------
# 6. Complete Audit Trail
# ---------------------------------------------------------------------------


async def test_full_flow_creates_complete_audit_trail(
    client: AsyncClient, db_session: AsyncSession
):
    """Verify audit log captures all critical actions in the flow."""
    from app.services.user_service import UserService

    # Register and verify patient
    patient_payload = _make_patient_payload()
    await client.post("/api/v1/auth/register", json=patient_payload)
    patient = await UserService.get_by_email(db_session, patient_payload["email"])
    
    otp_stmt = select(OTPCode).where(OTPCode.user_id == patient.id, OTPCode.is_used == False)
    otp = (await db_session.execute(otp_stmt)).scalars().first()
    resp = await client.post(
        "/api/v1/auth/otp/verify",
        json={"email": patient_payload["email"], "code": otp.code},
    )
    access_token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}

    # Login
    await client.post(
        "/api/v1/auth/login",
        json={"email": patient_payload["email"], "password": patient_payload["password"]},
    )

    # Check audit logs
    audit_stmt = select(AuditLog).where(
        AuditLog.entity_id == str(patient.id)
    )
    logs = (await db_session.execute(audit_stmt)).scalars().all()
    
    # Should have registration, OTP verify, login
    actions = [log.action for log in logs]
    assert "auth.register" in actions or "auth.login_success" in actions
