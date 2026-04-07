import enum
import uuid
from datetime import datetime, timezone
from typing import Optional, List, TYPE_CHECKING

from sqlalchemy import (
    String, DateTime, ForeignKey,
    Index, Text, UniqueConstraint, Enum as SAEnum,
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

class PatentStatus(str, enum.Enum):
    draft = "draft"
    submitted = "submitted"
    prechecked = "prechecked"
    under_review = "under_review"
    approved = "approved"
    rejected = "rejected"
    archived = "archived"


class DocumentType(str, enum.Enum):
    application = "application"
    grant = "grant"
    supporting = "supporting"
    ownership_proof = "ownership_proof"


class ReviewDecision(str, enum.Enum):
    approved = "approved"
    rejected = "rejected"
    needs_more_info = "needs_more_info"
    invalid = "invalid"


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class Patent(Base):
    __tablename__ = "patents"
    __table_args__ = (
        UniqueConstraint("patent_number", "jurisdiction", name="uq_patents_number_jurisdiction"),
        Index("ix_patents_owner_user_id", "owner_user_id"),
        Index("ix_patents_status", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    owner_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    patent_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    jurisdiction: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    abstract: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        SAEnum(*[s.value for s in PatentStatus], name="patent_status"),
        nullable=False,
        default=PatentStatus.draft,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )

    owner: Mapped["User"] = relationship(
        "User",
        foreign_keys=[owner_user_id],
        back_populates="patents",
    )
    documents: Mapped[List["PatentDocument"]] = relationship(
        back_populates="patent", cascade="all, delete-orphan"
    )
    reviews: Mapped[List["PatentReview"]] = relationship(
        back_populates="patent", cascade="all, delete-orphan"
    )


class PatentDocument(Base):
    __tablename__ = "patent_documents"
    __table_args__ = (
        Index("ix_patent_documents_patent_id", "patent_id"),
        Index("ix_patent_documents_created_by", "created_by_user_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    patent_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("patents.id", ondelete="CASCADE"), nullable=False
    )
    document_type: Mapped[Optional[str]] = mapped_column(
        SAEnum(*[d.value for d in DocumentType], name="document_type"),
        nullable=True,
    )
    storage_key: Mapped[str] = mapped_column(String(1024), nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    created_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    patent: Mapped["Patent"] = relationship(back_populates="documents")
    created_by: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[created_by_user_id]
    )


class PatentReview(Base):
    __tablename__ = "patent_reviews"
    __table_args__ = (
        Index("ix_patent_reviews_patent_id", "patent_id"),
        Index("ix_patent_reviews_reviewer", "reviewer_user_id"),
        Index("ix_patent_reviews_reviewed_at", "reviewed_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    patent_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("patents.id", ondelete="CASCADE"), nullable=False
    )
    reviewer_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    decision: Mapped[str] = mapped_column(
        SAEnum(*[d.value for d in ReviewDecision], name="review_decision"),
        nullable=False,
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reviewed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )

    patent: Mapped["Patent"] = relationship(back_populates="reviews")
    reviewer: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[reviewer_user_id]
    )
