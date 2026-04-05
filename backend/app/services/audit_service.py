from typing import Any, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

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
