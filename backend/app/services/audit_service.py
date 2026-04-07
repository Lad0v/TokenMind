from typing import Any, Optional
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.common import AuditLog


class AuditService:
    @staticmethod
    async def write(
        db: AsyncSession,
        action: str,
        entity_type: str,
        entity_id: Optional[str] = None,
        actor_id: Optional[UUID] = None,
        payload: Optional[dict[str, Any]] = None,
    ) -> None:
        record = AuditLog(
            actor_id=actor_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            payload=payload,
        )
        db.add(record)
        await db.flush()

    @staticmethod
    async def list_logs(
        db: AsyncSession,
        skip: int = 0,
        limit: int = 50,
        action: str | None = None,
        entity_type: str | None = None,
        search: str | None = None,
    ) -> tuple[list[AuditLog], int]:
        """List audit logs with lightweight filtering for admin UI."""
        query = select(AuditLog).options(joinedload(AuditLog.actor))
        count_query = select(func.count()).select_from(AuditLog)

        filters = []
        if action:
            filters.append(AuditLog.action == action)
        if entity_type:
            filters.append(AuditLog.entity_type == entity_type)
        if search:
            search_term = f"%{search.lower().strip()}%"
            filters.append(
                or_(
                    AuditLog.action.ilike(search_term),
                    AuditLog.entity_type.ilike(search_term),
                    AuditLog.entity_id.ilike(search_term),
                )
            )

        if filters:
            query = query.where(*filters)
            count_query = count_query.where(*filters)

        query = query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit)
        total = (await db.execute(count_query)).scalar() or 0
        items = (await db.execute(query)).scalars().all()
        return list(items), total
