"""User management endpoints.

Provides:
- Profile CRUD (get/update)
- Verification case submission, status check, and review
"""

import uuid
from typing import Optional

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db, get_redis
from app.core.security import get_current_user, require_roles
from app.models.user import User, VerificationStatus
from app.models.patent import Patent
from app.schemas.user import (
    ProfileRead,
    ProfileUpdate,
    VerificationCaseRead,
)
from app.services.user_service import UserService
from app.services.file_storage import save_verification_documents

router = APIRouter()


@router.get("/profile", response_model=ProfileRead)
async def get_my_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    profile = await UserService.get_profile(db, current_user.id)
    if not profile:
        return ProfileRead()
    return ProfileRead(legal_name=profile.full_name, country=profile.country)


@router.put("/profile", response_model=ProfileRead)
async def update_my_profile(
    payload: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    profile = await UserService.upsert_profile(db, current_user.id, payload)
    return ProfileRead(legal_name=profile.full_name, country=profile.country)


@router.post("/verification/documents", response_model=VerificationCaseRead, status_code=201)
async def submit_verification_documents(
    id_document: UploadFile = File(...),
    selfie: UploadFile = File(...),
    video: Optional[UploadFile] = File(None),
    user_address: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Step 2 — Document Collection: upload ID, selfie, optional video, and provide address."""
    # Only issuers (patent submitters) can do verification
    if current_user.role != "issuer":
        raise HTTPException(
            status_code=400,
            detail="Верификация доступна только для patent submitter (issuer)",
        )

    existing_vc = await UserService.get_latest_verification_case(db, current_user.id)

    if existing_vc and existing_vc.status in {
        VerificationStatus.pending.value,
        VerificationStatus.approved.value,
    }:
        raise HTTPException(
            status_code=400,
            detail="Верификация уже в процессе или одобрена",
        )

    id_doc_path, selfie_path, video_path = await save_verification_documents(
        user_id=current_user.id,
        id_document=id_document,
        selfie=selfie,
        video=video,
    )

    if existing_vc and existing_vc.status == VerificationStatus.rejected.value:
        existing_vc.id_document_url = id_doc_path
        existing_vc.selfie_url = selfie_path
        existing_vc.user_address = user_address
        existing_vc.video_url = video_path
        existing_vc.status = VerificationStatus.pending.value
        await db.flush()
        await db.refresh(existing_vc)
        return existing_vc

    vc = await UserService.create_verification_case(
        db=db,
        user_id=current_user.id,
        id_document_url=id_doc_path,
        selfie_url=selfie_path,
        user_address=user_address,
        video_url=video_path,
    )
    return vc


@router.get("/verification/status", response_model=VerificationCaseRead)
async def get_verification_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check current verification status."""
    vc = await UserService.get_latest_verification_case(db, current_user.id)
    if not vc:
        raise HTTPException(status_code=404, detail="Верификация не найдена")
    return vc


# --- Account management for investors ---


@router.post("/upgrade-to-issuer", response_model=dict)
async def upgrade_to_issuer(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
):
    """Upgrade investor role to issuer (enables patent submission).

    This triggers OTP verification flow. After OTP verification,
    user role changes from 'investor' to 'issuer'.
    """
    from app.models.user import UserRole
    from app.services.otp_service import generate_and_send_otp
    from app.services.audit_service import AuditService

    if current_user.role == UserRole.issuer.value:
        raise HTTPException(
            status_code=400,
            detail="User is already an issuer",
        )

    if current_user.role != UserRole.investor.value:
        raise HTTPException(
            status_code=403,
            detail="Only investors can upgrade to issuer",
        )

    if not current_user.email:
        raise HTTPException(
            status_code=400,
            detail="Email required for issuer role. Please update profile first.",
        )

    # Start OTP flow for issuer upgrade
    try:
        await generate_and_send_otp(redis, current_user.email, "issuer_upgrade")
    except (HTTPException, RuntimeError) as exc:
        import logging
        error_detail = exc.detail if hasattr(exc, 'detail') else str(exc)
        logging.getLogger(__name__).warning(
            "OTP delivery failed for issuer upgrade: %s", error_detail
        )

    await AuditService.write(
        db,
        action="user_upgrade_to_issuer",
        entity_type="user",
        entity_id=str(current_user.id),
        actor_id=current_user.id,
    )

    return {
        "message": "OTP sent to your email. Verify OTP to complete upgrade to issuer.",
    }


@router.delete("/account", response_model=dict)
async def delete_account(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete user account (soft delete by setting status=blocked).

    For investors: can delete account at any time.
    For issuers: can delete only if no active IP claims.
    """
    from app.models.user import UserRole, UserStatus
    from app.services.audit_service import AuditService

    # Issuers with active claims cannot delete
    if current_user.role == UserRole.issuer.value:
        from app.models.ip_claim import IpClaim
        from sqlalchemy import select, func

        stmt = select(func.count()).select_from(IpClaim).where(
            IpClaim.issuer_user_id == current_user.id,
            IpClaim.status.in_(["draft", "submitted", "prechecked", "under_review"]),
        )
        result = await db.execute(stmt)
        active_claims_count = result.scalar()

        if active_claims_count > 0:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete account with {active_claims_count} active IP claims. Please resolve them first.",
            )

    # Soft delete
    current_user.status = UserStatus.blocked.value
    await db.flush()

    await AuditService.write(
        db,
        action="user_account_deleted",
        entity_type="user",
        entity_id=str(current_user.id),
        actor_id=current_user.id,
        payload={"role": current_user.role, "email": current_user.email},
    )

    return {"success": True, "message": "Account deleted successfully"}
