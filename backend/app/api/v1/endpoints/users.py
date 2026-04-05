"""User management endpoints.

Provides:
- Profile CRUD (get/update)
- Verification case submission, status check, and review
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.user import User, VerificationStatus
from app.schemas.user import ProfileRead, ProfileUpdate, VerificationCaseRead
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


# --- Verification case endpoints ---


@router.post("/verification/documents", response_model=VerificationCaseRead, status_code=201)
async def submit_verification_documents(
    id_document: UploadFile = File(...),
    selfie: UploadFile = File(...),
    user_address: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Step 2 — Document Collection: upload ID, selfie, and provide address."""
    if current_user.role not in {"user", "issuer"}:
        raise HTTPException(
            status_code=400,
            detail="Верификация доступна только для patent submitter",
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

    id_doc_path, selfie_path = await save_verification_documents(
        user_id=current_user.id,
        id_document=id_document,
        selfie=selfie,
    )

    if existing_vc and existing_vc.status == VerificationStatus.rejected.value:
        existing_vc.id_document_url = id_doc_path
        existing_vc.selfie_url = selfie_path
        existing_vc.user_address = user_address
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


@router.post("/verification/review/{case_id}", response_model=VerificationCaseRead)
async def review_verification(
    case_id: uuid.UUID,
    decision: str = Form(...),
    notes: str = Form(None),
    reviewer: User = Depends(require_roles("admin", "compliance_officer")),
    db: AsyncSession = Depends(get_db),
):
    """Step 3 — Human Review: approve or reject verification case."""
    vc = await UserService.get_latest_verification_case(db, case_id)
    # get_latest_verification_case searches by user_id, but case_id is the VC id
    # Need to query by id instead
    from sqlalchemy import select
    from app.models.user import VerificationCase

    stmt = select(VerificationCase).where(VerificationCase.id == case_id)
    result = await db.execute(stmt)
    vc = result.scalar_one_or_none()

    if not vc:
        raise HTTPException(status_code=404, detail="Верификация не найдена")

    updated_vc = await UserService.review_verification_case(
        db=db,
        case=vc,
        reviewer_id=reviewer.id,
        decision=decision,
        notes=notes,
    )
    return updated_vc
