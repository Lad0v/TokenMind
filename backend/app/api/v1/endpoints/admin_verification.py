"""Admin verification queue endpoints."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import require_roles
from app.models.user import User, VerificationStatus
from app.schemas.admin import (
    VerificationCaseAdminListResponse,
    VerificationCaseReviewRequest,
    VerificationCaseAdminResponse,
    VerificationCaseAdminUserRead,
)
from app.services.user_service import UserService

router = APIRouter()


def _build_verification_case_response(case) -> VerificationCaseAdminResponse:
    user = case.user
    profile = getattr(user, "profile", None)

    return VerificationCaseAdminResponse(
        id=case.id,
        user_id=case.user_id,
        status=case.status,
        patent_name=case.patent_name,
        patent_address=case.patent_address,
        user_address=case.user_address,
        id_document_url=case.id_document_url,
        selfie_url=case.selfie_url,
        reviewer_notes=case.reviewer_notes,
        reviewed_by=case.reviewed_by,
        reviewed_at=case.reviewed_at,
        created_at=case.created_at,
        updated_at=case.updated_at,
        user=VerificationCaseAdminUserRead(
            id=user.id,
            email=user.email,
            role=user.role,
            status=user.status,
            full_name=profile.full_name if profile else None,
        ),
    )


@router.get("", response_model=VerificationCaseAdminListResponse)
async def list_verification_cases(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: VerificationStatus | None = Query(None),
    search: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_roles("admin", "compliance_officer")),
):
    cases, total = await UserService.list_verification_cases_admin(
        db=db,
        skip=skip,
        limit=limit,
        status=status,
        search=search,
    )
    return VerificationCaseAdminListResponse(
        total=total,
        skip=skip,
        limit=limit,
        items=[_build_verification_case_response(case) for case in cases],
    )


@router.get("/{case_id}", response_model=VerificationCaseAdminResponse)
async def get_verification_case(
    case_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_roles("admin", "compliance_officer")),
):
    case = await UserService.get_verification_case_admin_detail(db=db, case_id=case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Верификация не найдена")
    return _build_verification_case_response(case)


@router.post("/{case_id}/review", response_model=VerificationCaseAdminResponse)
async def review_verification_case(
    case_id: uuid.UUID,
    payload: VerificationCaseReviewRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_roles("admin", "compliance_officer")),
):
    case = await UserService.get_verification_case_admin_detail(db=db, case_id=case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Верификация не найдена")

    await UserService.review_verification_case(
        db=db,
        case=case,
        reviewer_id=admin.id,
        decision=payload.decision,
        notes=payload.notes,
    )

    refreshed_case = await UserService.get_verification_case_admin_detail(db=db, case_id=case_id)
    if not refreshed_case:
        raise HTTPException(status_code=404, detail="Верификация не найдена")

    return _build_verification_case_response(refreshed_case)
