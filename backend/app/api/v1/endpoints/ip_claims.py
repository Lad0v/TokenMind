"""IP Claims management endpoints.

Provides:
- Create, list, get IP claims
- Document upload
- Review workflow (admin/compliance_officer)
"""

import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.user import User
from app.schemas.ip_claim import (
    CreateIpClaimRequest,
    IpClaimDocumentRead,
    IpClaimListResponse,
    IpClaimResponse,
    IpClaimReviewRead,
    IpClaimReviewRequest,
    UploadDocumentResponse,
)
from app.services.audit_service import AuditService
from app.services.ip_claim_service import IpClaimService
from app.services.file_storage import save_ip_claim_document

router = APIRouter()


def _build_ip_claim_response(claim) -> IpClaimResponse:
    issuer = getattr(claim, "issuer", None)
    issuer_profile = getattr(issuer, "profile", None) if issuer else None

    return IpClaimResponse(
        id=claim.id,
        issuer_user_id=claim.issuer_user_id,
        issuer_email=issuer.email if issuer else None,
        issuer_name=issuer_profile.full_name if issuer_profile else None,
        patent_number=claim.patent_number,
        patent_title=claim.patent_title,
        claimed_owner_name=claim.claimed_owner_name,
        description=claim.description,
        jurisdiction=claim.jurisdiction,
        status=claim.status,
        prechecked=claim.prechecked,
        precheck_status=claim.precheck_status,
        source_id=claim.source_id,
        checked_at=claim.checked_at,
        patent_metadata=claim.patent_metadata,
        external_metadata=claim.external_metadata,
        created_at=claim.created_at,
        updated_at=claim.updated_at,
        documents=[
            IpClaimDocumentRead(
                id=document.id,
                file_url=document.file_url,
                doc_type=document.doc_type,
                uploaded_at=document.uploaded_at,
                created_by_user_id=document.created_by_user_id,
            )
            for document in getattr(claim, "documents", [])
        ],
        reviews=[
            IpClaimReviewRead(
                id=review.id,
                reviewer_id=review.reviewer_id,
                reviewer_email=review.reviewer.email if getattr(review, "reviewer", None) else None,
                decision=review.decision,
                notes=review.notes,
                created_at=review.created_at,
            )
            for review in getattr(claim, "reviews", [])
        ],
    )


@router.post("", response_model=IpClaimResponse)
async def create_ip_claim(
    payload: CreateIpClaimRequest,
    current_user: User = Depends(require_roles("issuer", "admin", "user")),
    db: AsyncSession = Depends(get_db),
):
    claim = await IpClaimService.create(db, current_user.id, payload)
    await AuditService.write(
        db,
        action="ip_claim.created",
        entity_type="ip_claim",
        entity_id=str(claim.id),
        actor_id=current_user.id,
    )
    created_with_relations = await IpClaimService.get_by_id(db, claim.id, with_relations=True)
    return _build_ip_claim_response(created_with_relations or claim)


@router.get("", response_model=IpClaimListResponse)
async def list_ip_claims(
    status_filter: str | None = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    total, items = await IpClaimService.list_claims(db, current_user, status_filter, skip, limit)
    return IpClaimListResponse(
        total=total,
        items=[_build_ip_claim_response(item) for item in items],
    )


@router.get("/{claim_id}", response_model=IpClaimResponse)
async def get_ip_claim(
    claim_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    claim = await IpClaimService.get_by_id(db, claim_id, with_relations=True)
    if not claim:
        raise HTTPException(status_code=404, detail="IP claim не найден")

    if current_user.role in {"admin", "compliance_officer"}:
        return _build_ip_claim_response(claim)

    if current_user.role == "investor":
        if claim.status != "approved":
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        return _build_ip_claim_response(claim)

    if claim.issuer_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    return _build_ip_claim_response(claim)


@router.post("/{claim_id}/documents", response_model=UploadDocumentResponse)
async def upload_ip_claim_document(
    claim_id: uuid.UUID,
    file: UploadFile = File(...),
    doc_type: str | None = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    claim = await IpClaimService.get_by_id(db, claim_id, with_relations=True)
    if not claim:
        raise HTTPException(status_code=404, detail="IP claim не найден")

    if claim.issuer_user_id != current_user.id and current_user.role not in {"admin", "compliance_officer"}:
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
    reviewer: User = Depends(require_roles("admin", "compliance_officer")),
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
    refreshed = await IpClaimService.get_by_id(db, claim_id, with_relations=True)
    return _build_ip_claim_response(refreshed or updated)
