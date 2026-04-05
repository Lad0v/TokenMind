import enum
import uuid
from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING

from sqlalchemy import (
    String, DateTime, ForeignKey,
    Index, JSON, Enum as SAEnum,
)
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class WebhookEventStatus(str, enum.Enum):
    received = "received"
    processed = "processed"
    failed = "failed"
    dead_letter = "dead_letter"


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class AuditLog(Base):
    """Immutable audit trail for all critical platform actions."""
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_logs_entity", "entity_type", "entity_id"),
        Index("ix_audit_logs_actor_created", "actor_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    # NULL for system-initiated actions
    actor_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    # Non-PII business details: old/new status, external IDs, checksums
    payload: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )

    actor: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[actor_id]
    )


class WebhookEvent(Base):
    """Inbound webhook events from KYC providers, USPTO, and other external systems."""
    __tablename__ = "webhook_events"
    __table_args__ = (
        Index("ix_webhook_events_source_external", "source", "external_id"),
        Index("ix_webhook_events_status", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    source: Mapped[str] = mapped_column(String(100), nullable=False)
    external_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(
        SAEnum(*[s.value for s in WebhookEventStatus], name="webhook_event_status"),
        nullable=False,
        default=WebhookEventStatus.received,
    )
    # Raw payload — should be encrypted/pseudonymised per data policy before storage
    payload: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )
