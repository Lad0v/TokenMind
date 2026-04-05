"""Admin patent management endpoints.

Provides CRUD for patents with RBAC (admin, compliance_officer):
- GET    /api/v1/admin/patents                   — list patents with pagination
- GET    /api/v1/admin/patents/{patent_id}       — patent detail with relations
- PUT    /api/v1/admin/patents/{patent_id}/status — change patent status
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import require_roles
from app.models.user import User
from app.models.patent import Patent, PatentStatus, PatentReview
from app.schemas.admin import (
    PatentAdminResponse,
    PatentAdminDetailResponse,
    PatentAdminListResponse,
    PatentStatusUpdateRequest,
    PatentStatusUpdateResponse,
    PatentOwnerProfileRead,
    PatentReviewRead,
)
from app.services.admin_patent_service import AdminPatentService

router = APIRouter()


def _build_patent_admin_response(patent: Patent) -> PatentAdminResponse:
    """Build PatentAdminResponse from Patent model."""
    return PatentAdminResponse(
        id=patent.id,
        patent_number=patent.patent_number,
        jurisdiction=patent.jurisdiction,
        title=patent.title,
        status=PatentStatus(patent.status),
        owner_user_id=patent.owner_user_id,
        created_at=patent.created_at,
    )


def _build_patent_admin_detail_response(patent: Patent) -> PatentAdminDetailResponse:
    """Build PatentAdminDetailResponse from Patent model."""
    base = _build_patent_admin_response(patent)

    # Get owner profile
    owner_profile = None
    if hasattr(patent, "owner") and patent.owner:
        owner = patent.owner
        if hasattr(owner, "profile") and owner.profile:
            owner_profile = PatentOwnerProfileRead(
                full_name=owner.profile.full_name,
                country=owner.profile.country,
                organization_name=owner.profile.organization_name,
            )

    # Get documents count
    documents_count = 0
    if hasattr(patent, "documents"):
        documents_count = len(patent.documents)

    # Get reviews
    reviews = []
    if hasattr(patent, "reviews"):
        reviews = [
            PatentReviewRead(
                id=r.id,
                reviewer_user_id=r.reviewer_user_id,
                decision=r.decision,
                notes=r.notes,
                reviewed_at=r.reviewed_at,
            )
            for r in patent.reviews
        ]

    return PatentAdminDetailResponse(
        id=base.id,
        patent_number=base.patent_number,
        jurisdiction=base.jurisdiction,
        title=base.title,
        status=base.status,
        owner_user_id=base.owner_user_id,
        created_at=base.created_at,
        owner_profile=owner_profile,
        documents_count=documents_count,
        reviews=reviews,
    )


@router.get("", response_model=PatentAdminListResponse)
async def list_patents(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: PatentStatus | None = Query(None),
    jurisdiction: str | None = Query(None),
    owner_user_id: uuid.UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_roles("admin", "compliance_officer")),
):
    """List patents with filtering and pagination."""
    patents, total = await AdminPatentService.list_patents_admin(
        db=db,
        skip=skip,
        limit=limit,
        status=status,
        jurisdiction=jurisdiction,
        owner_user_id=owner_user_id,
    )

    items = [_build_patent_admin_response(p) for p in patents]

    return PatentAdminListResponse(
        total=total,
        skip=skip,
        limit=limit,
        items=items,
    )


@router.get("/{patent_id}", response_model=PatentAdminDetailResponse)
async def get_patent(
    patent_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_roles("admin", "compliance_officer")),
):
    """Get patent detail with relations."""
    patent = await AdminPatentService.get_patent_admin_detail(db=db, patent_id=patent_id)
    if not patent:
        raise HTTPException(status_code=404, detail="Патент не найден")

    return _build_patent_admin_detail_response(patent)


@router.put("/{patent_id}/status", response_model=PatentStatusUpdateResponse)
async def change_patent_status(
    patent_id: uuid.UUID,
    payload: PatentStatusUpdateRequest,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_roles("admin", "compliance_officer")),
):
    """Change patent status with audit logging."""
    patent = await AdminPatentService.change_patent_status(
        db=db,
        patent_id=patent_id,
        new_status=payload.status,
        notes=payload.notes,
        actor_id=admin_user.id,
    )

    return PatentStatusUpdateResponse(
        patent_id=patent.id,
        new_status=PatentStatus(patent.status),
    )
