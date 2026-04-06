import enum
import uuid
from datetime import datetime, timezone
from typing import Optional, List, TYPE_CHECKING

from sqlalchemy import (
    String,
    DateTime,
    ForeignKey,
    Index,
    Text,
    Enum as SAEnum,
    JSON,
    Boolean,
)
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class IpClaimStatus(str, enum.Enum):
    draft = "draft"
    submitted = "submitted"
    prechecked = "prechecked"
    awaiting_kyc = "awaiting_kyc"
    under_review = "under_review"
    approved = "approved"
    rejected = "rejected"


class IpReviewDecision(str, enum.Enum):
    approve = "approve"
    reject = "reject"
    request_more_data = "request_more_data"


class IpClaim(Base):
    __tablename__ = "ip_claims"
    __table_args__ = (
        Index("ix_ip_claims_issuer", "issuer_user_id"),
        Index("ix_ip_claims_status", "status"),
        Index("ix_ip_claims_patent_number", "patent_number"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    issuer_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    patent_number: Mapped[str] = mapped_column(String(100), nullable=False)
    patent_title: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    claimed_owner_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    jurisdiction: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    status: Mapped[str] = mapped_column(
        SAEnum(*[s.value for s in IpClaimStatus], name="ip_claim_status"),
        nullable=False,
        default=IpClaimStatus.draft,
    )
    prechecked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    precheck_status: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    source_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    checked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    patent_metadata: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # JSONB поле для внешних метаданных из патентных API (модуль ip_intel)
    external_metadata: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )

    issuer: Mapped["User"] = relationship("User", foreign_keys=[issuer_user_id], back_populates="ip_claims")
    documents: Mapped[List["IpDocument"]] = relationship(back_populates="ip_claim", cascade="all, delete-orphan")
    reviews: Mapped[List["IpReview"]] = relationship(back_populates="ip_claim", cascade="all, delete-orphan")
    # Связь с кэшем патентов (модуль ip_intel)
    patent_cache_records: Mapped[List["PatentCache"]] = relationship(
        "PatentCache", foreign_keys="PatentCache.ip_claim_id", back_populates="ip_claim"
    )


class IpDocument(Base):
    __tablename__ = "ip_documents"
    __table_args__ = (
        Index("ix_ip_documents_claim", "ip_claim_id"),
        Index("ix_ip_documents_uploader", "created_by_user_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    ip_claim_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("ip_claims.id", ondelete="CASCADE"), nullable=False
    )
    file_url: Mapped[str] = mapped_column(String(1024), nullable=False)
    doc_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)
    created_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    ip_claim: Mapped["IpClaim"] = relationship(back_populates="documents")


class IpReview(Base):
    __tablename__ = "ip_reviews"
    __table_args__ = (
        Index("ix_ip_reviews_claim", "ip_claim_id"),
        Index("ix_ip_reviews_reviewer", "reviewer_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    ip_claim_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("ip_claims.id", ondelete="CASCADE"), nullable=False
    )
    reviewer_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    decision: Mapped[str] = mapped_column(
        SAEnum(*[d.value for d in IpReviewDecision], name="ip_review_decision"),
        nullable=False,
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)

    ip_claim: Mapped["IpClaim"] = relationship(back_populates="reviews")
    reviewer: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[reviewer_id], back_populates="ip_claim_reviews"
    )


class TokenRevocation(Base):
    __tablename__ = "token_revocations"
    __table_args__ = (
        Index("ix_token_revocations_expires_at", "expires_at"),
    )

    jti: Mapped[str] = mapped_column(String(64), primary_key=True)
    token_type: Mapped[str] = mapped_column(String(16), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)
