"""IP Claims management endpoints.

Provides:
- List, get IP claims
- Document upload
- Review workflow (admin)

Note: IP claim creation is now handled by POST /api/v1/auth/submit-patent
which includes the OTP verification flow.
"""

import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.user import User
from app.schemas.ip_claim import (
    IpClaimListResponse,
    IpClaimResponse,
    IpClaimReviewRequest,
    UploadDocumentResponse,
)
from app.services.audit_service import AuditService
from app.services.ip_claim_service import IpClaimService
from app.services.file_storage import save_ip_claim_document

router = APIRouter()


@router.get("", response_model=IpClaimListResponse)
async def list_ip_claims(
    status_filter: str | None = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    total, items = await IpClaimService.list_claims(db, status_filter, skip, limit)
    return IpClaimListResponse(
        total=total,
        items=[IpClaimResponse.model_validate(item) for item in items],
    )


@router.get("/{claim_id}", response_model=IpClaimResponse)
async def get_ip_claim(
    claim_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    claim = await IpClaimService.get_by_id(db, claim_id)
    if not claim:
        raise HTTPException(status_code=404, detail="IP claim не найден")

    if current_user.role not in {"admin"} and claim.issuer_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    return claim


@router.post("/{claim_id}/documents", response_model=UploadDocumentResponse)
async def upload_ip_claim_document(
    claim_id: uuid.UUID,
    file: UploadFile = File(...),
    doc_type: str | None = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    claim = await IpClaimService.get_by_id(db, claim_id)
    if not claim:
        raise HTTPException(status_code=404, detail="IP claim не найден")

    if claim.issuer_user_id != current_user.id and current_user.role not in {"admin"}:
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    file_url = await save_ip_claim_document(claim_id=claim.id, file=file)

    uploaded = await IpClaimService.register_document(
        db=db,
        claim=claim,
        uploader_user_id=current_user.id,
        file_url=file_url,
        doc_type=doc_type,
    )
    return uploaded


@router.post("/{claim_id}/review", response_model=IpClaimResponse)
async def review_ip_claim(
    claim_id: uuid.UUID,
    payload: IpClaimReviewRequest,
    reviewer: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    claim = await IpClaimService.get_by_id(db, claim_id)
    if not claim:
        raise HTTPException(status_code=404, detail="IP claim не найден")

    updated = await IpClaimService.review(db, claim, reviewer.id, payload)
    await AuditService.write(
        db,
        action="ip_claim.reviewed",
        entity_type="ip_claim",
        entity_id=str(updated.id),
        actor_id=reviewer.id,
        payload={"decision": payload.decision, "new_status": updated.status},
    )
    return updated
