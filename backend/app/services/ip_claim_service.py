import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ip_claim import IpClaim, IpClaimStatus, IpDocument, IpReview, IpReviewDecision
from app.schemas.ip_claim import CreateIpClaimRequest, IpClaimReviewRequest


class IpClaimService:
    @staticmethod
    async def create(db: AsyncSession, issuer_user_id: uuid.UUID, payload: CreateIpClaimRequest) -> IpClaim:
        snapshot = payload.precheck_snapshot or {}
        claim = IpClaim(
            issuer_user_id=issuer_user_id,
            patent_number=payload.patent_number.strip().upper(),
            patent_title=payload.patent_title,
            claimed_owner_name=payload.claimed_owner_name,
            description=payload.description,
            jurisdiction=payload.jurisdiction,
            status=IpClaimStatus.submitted,
            prechecked=bool(snapshot),
            precheck_status=snapshot.get("status"),
            source_id=snapshot.get("source_id"),
            checked_at=datetime.now(timezone.utc) if snapshot else None,
            patent_metadata=snapshot.get("metadata") if snapshot else None,
        )
        db.add(claim)
        await db.flush()
        await db.refresh(claim)
        return claim

    @staticmethod
    async def list_claims(db: AsyncSession, status_filter: str | None, skip: int, limit: int):
        query = select(IpClaim)
        count_query = select(func.count()).select_from(IpClaim)
        if status_filter:
            query = query.where(IpClaim.status == status_filter)
            count_query = count_query.where(IpClaim.status == status_filter)

        query = query.order_by(IpClaim.created_at.desc()).offset(skip).limit(limit)

        total = (await db.execute(count_query)).scalar() or 0
        items = (await db.execute(query)).scalars().all()
        return total, items

    @staticmethod
    async def get_by_id(db: AsyncSession, claim_id: uuid.UUID) -> IpClaim | None:
        result = await db.execute(select(IpClaim).where(IpClaim.id == claim_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def upload_document(
        db: AsyncSession,
        claim: IpClaim,
        uploader_user_id: uuid.UUID,
        document: UploadFile,
        doc_type: str | None,
    ) -> IpDocument:
        """Legacy: upload and save document. Use register_document + file_storage instead."""
        upload_dir = Path("uploads") / "ip_claims" / str(claim.id)
        upload_dir.mkdir(parents=True, exist_ok=True)

        safe_name = document.filename or f"document-{uuid.uuid4().hex}.bin"
        target = upload_dir / safe_name
        content = await document.read()
        target.write_bytes(content)

        record = IpDocument(
            ip_claim_id=claim.id,
            file_url=str(target).replace("\\", "/"),
            doc_type=doc_type,
            created_by_user_id=uploader_user_id,
        )
        db.add(record)
        await db.flush()
        await db.refresh(record)
        return record

    @staticmethod
    async def register_document(
        db: AsyncSession,
        claim: IpClaim,
        uploader_user_id: uuid.UUID,
        file_url: str,
        doc_type: str | None,
    ) -> IpDocument:
        """Register an already-saved document in the database."""
        record = IpDocument(
            ip_claim_id=claim.id,
            file_url=file_url,
            doc_type=doc_type,
            created_by_user_id=uploader_user_id,
        )
        db.add(record)
        await db.flush()
        await db.refresh(record)
        return record

    @staticmethod
    async def review(
        db: AsyncSession,
        claim: IpClaim,
        reviewer_id: uuid.UUID,
        payload: IpClaimReviewRequest,
    ) -> IpClaim:
        from app.services.audit_service import AuditService

        db.add(
            IpReview(
                ip_claim_id=claim.id,
                reviewer_id=reviewer_id,
                decision=payload.decision,
                notes=payload.notes,
            )
        )

        if payload.decision == IpReviewDecision.approve:
            claim.status = IpClaimStatus.approved
        elif payload.decision == IpReviewDecision.reject:
            claim.status = IpClaimStatus.rejected
        else:
            claim.status = IpClaimStatus.submitted

        await db.flush()
        await db.refresh(claim)

        await AuditService.write(
            db,
            action="ip_claim.reviewed",
            entity_type="ip_claim",
            entity_id=str(claim.id),
            actor_id=reviewer_id,
            payload={"decision": payload.decision, "new_status": claim.status.value if hasattr(claim.status, 'value') else claim.status},
        )

        return claim
