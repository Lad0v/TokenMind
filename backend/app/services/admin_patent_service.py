"""Admin patent service — admin operations for patents.

Provides:
- list_patents_admin: paginated list with filtering
- get_patent_admin_detail: detailed patent view with relations
- change_patent_status: status change with audit logging
"""

import uuid
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.patent import Patent, PatentStatus, PatentDocument, PatentReview
from app.models.user import Profile
from app.services.audit_service import AuditService


class AdminPatentService:
    """Service for admin patent operations."""

    @staticmethod
    async def list_patents_admin(
        db: AsyncSession,
        skip: int = 0,
        limit: int = 50,
        status: Optional[PatentStatus] = None,
        jurisdiction: Optional[str] = None,
        owner_user_id: Optional[uuid.UUID] = None,
    ) -> tuple[list[Patent], int]:
        """List patents with filtering and pagination.

        Returns tuple of (patents, total_count).
        """
        base_query = select(Patent)
        filters = []

        if status is not None:
            filters.append(Patent.status == status)
        if jurisdiction is not None:
            filters.append(Patent.jurisdiction == jurisdiction)
        if owner_user_id is not None:
            filters.append(Patent.owner_user_id == owner_user_id)

        if filters:
            base_query = base_query.where(*filters)

        # Get total count
        count_query = select(func.count()).select_from(Patent)
        if filters:
            count_query = count_query.where(*filters)

        total_result = await db.execute(count_query)
        total = total_result.scalar()

        # Get paginated results
        base_query = base_query.offset(skip).limit(limit)
        result = await db.execute(base_query)
        patents = result.scalars().all()

        return list(patents), total

    @staticmethod
    async def get_patent_admin_detail(
        db: AsyncSession,
        patent_id: uuid.UUID,
    ) -> Optional[Patent]:
        """Get patent with all relations for admin detail view."""
        stmt = (
            select(Patent)
            .where(Patent.id == patent_id)
            .options(
                joinedload(Patent.owner).joinedload(Patent.owner.profile),
                joinedload(Patent.documents),
                joinedload(Patent.reviews),
            )
        )
        result = await db.execute(stmt)
        return result.scalars().unique().one_or_none()

    @staticmethod
    async def change_patent_status(
        db: AsyncSession,
        patent_id: uuid.UUID,
        new_status: PatentStatus,
        notes: str,
        actor_id: uuid.UUID,
    ) -> Patent:
        """Change patent status with audit logging.

        Only admin can set: approved, rejected, archived.
        """
        stmt = select(Patent).where(Patent.id == patent_id)
        result = await db.execute(stmt)
        patent = result.scalar_one_or_none()

        if not patent:
            raise HTTPException(status_code=404, detail="Патент не найден")

        old_status = PatentStatus(patent.status)

        # Validate that admin can set these statuses
        allowed_admin_statuses = {
            PatentStatus.approved,
            PatentStatus.rejected,
            PatentStatus.archived,
        }

        if new_status not in allowed_admin_statuses:
            raise HTTPException(
                status_code=400,
                detail=f"Недопустимый статус для администратора: {new_status.value}",
            )

        patent.status = new_status.value
        await db.flush()
        await db.refresh(patent)

        # Audit log (exclude any sensitive URLs from payload)
        await AuditService.write(
            db=db,
            action="patent_status_change",
            entity_type="patent",
            entity_id=str(patent_id),
            actor_id=actor_id,
            payload={
                "old_status": old_status.value,
                "new_status": new_status.value,
                "notes": notes,
            },
        )

        return patent
