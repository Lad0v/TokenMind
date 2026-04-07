import enum
import uuid
from datetime import datetime, timezone
from typing import Optional, List, TYPE_CHECKING

from sqlalchemy import (
    String, Boolean, DateTime, ForeignKey,
    Index, Text, UniqueConstraint, Enum as SAEnum, JSON,
)
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.ip_claim import IpClaim, IpReview
    from app.models.patent import Patent


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class UserRole(str, enum.Enum):
    user = "user"
    issuer = "issuer"
    investor = "investor"
    compliance_officer = "compliance_officer"
    admin = "admin"


class UserStatus(str, enum.Enum):
    pending_otp = "pending_otp"
    active = "active"
    suspended = "suspended"
    blocked = "blocked"
    rejected = "rejected"


class VerificationStatus(str, enum.Enum):
    not_started = "not_started"
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class KYCCaseStatus(str, enum.Enum):
    not_started = "not_started"
    pending = "pending"
    needs_input = "needs_input"
    manual_review = "manual_review"
    approved = "approved"
    rejected = "rejected"
    expired = "expired"


class KYCRiskLevel(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    unknown = "unknown"


class SanctionCheckStatus(str, enum.Enum):
    pending = "pending"
    clear = "clear"
    matches_found = "matches_found"
    manual_review = "manual_review"
    failed = "failed"


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        Index("ix_users_status", "status"),
        Index("ix_users_role", "role"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    auth_provider_ref: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    role: Mapped[str] = mapped_column(
        SAEnum(*[r.value for r in UserRole], name="user_role"),
        nullable=False,
        default=UserRole.user,
    )
    status: Mapped[str] = mapped_column(
        SAEnum(*[s.value for s in UserStatus], name="user_status"),
        nullable=False,
        default=UserStatus.pending_otp,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )

    # Relationships
    profile: Mapped[Optional["Profile"]] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    kyc_cases: Mapped[List["KYCCase"]] = relationship(back_populates="user")
    sanctions_checks: Mapped[List["SanctionCheck"]] = relationship(back_populates="user")
    wallet_links: Mapped[List["WalletLink"]] = relationship(back_populates="user")
    patents: Mapped[List["Patent"]] = relationship(
        "Patent",
        foreign_keys="[Patent.owner_user_id]",
        back_populates="owner",
    )
    ip_claims: Mapped[List["IpClaim"]] = relationship(
        "IpClaim",
        foreign_keys="IpClaim.issuer_user_id",
        back_populates="issuer",
    )
    ip_claim_reviews: Mapped[List["IpReview"]] = relationship(
        "IpReview",
        foreign_keys="[IpReview.reviewer_id]",
        back_populates="reviewer",
    )
    otp_codes: Mapped[List["OTPCode"]] = relationship(back_populates="user")
    verification_cases: Mapped[List["VerificationCase"]] = relationship(back_populates="user")


class Profile(Base):
    __tablename__ = "profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    full_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    country: Mapped[Optional[str]] = mapped_column(String(3), nullable=True)
    organization_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    preferred_language: Mapped[Optional[str]] = mapped_column(String(5), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )

    user: Mapped["User"] = relationship(back_populates="profile")


class KYCCase(Base):
    __tablename__ = "kyc_cases"
    __table_args__ = (
        UniqueConstraint("provider", "provider_case_id", name="uq_kyc_cases_provider_case"),
        Index("ix_kyc_cases_user_id", "user_id"),
        Index("ix_kyc_cases_provider_case", "provider", "provider_case_id"),
        Index("ix_kyc_cases_status", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    provider: Mapped[str] = mapped_column(String(100), nullable=False)
    provider_case_id: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(
        SAEnum(*[s.value for s in KYCCaseStatus], name="kyc_case_status"),
        nullable=False,
        default=KYCCaseStatus.not_started,
    )
    risk_level: Mapped[Optional[str]] = mapped_column(
        SAEnum(*[r.value for r in KYCRiskLevel], name="kyc_risk_level"),
        nullable=True,
        default=KYCRiskLevel.unknown,
    )
    review_result: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )

    user: Mapped["User"] = relationship(back_populates="kyc_cases")


class SanctionCheck(Base):
    __tablename__ = "sanctions_checks"
    __table_args__ = (
        Index("ix_sanctions_checks_user_id", "user_id"),
        Index("ix_sanctions_checks_checked_at", "checked_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        SAEnum(*[s.value for s in SanctionCheckStatus], name="sanction_check_status"),
        nullable=False,
        default=SanctionCheckStatus.pending,
    )
    flags: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    checked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )

    user: Mapped["User"] = relationship(back_populates="sanctions_checks")


class WalletLink(Base):
    __tablename__ = "wallet_links"
    __table_args__ = (
        UniqueConstraint("wallet_address", "network", name="uq_wallet_links_address_network"),
        Index("ix_wallet_links_user_id", "user_id"),
        # Partial unique index: only one primary wallet per user per network (PostgreSQL)
        Index(
            "uix_wallet_links_user_network_primary",
            "user_id",
            "network",
            postgresql_where="is_primary IS TRUE",
            unique=True,
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    wallet_address: Mapped[str] = mapped_column(String(100), nullable=False)
    network: Mapped[str] = mapped_column(String(50), nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )

    user: Mapped["User"] = relationship(back_populates="wallet_links")


class OTPCode(Base):
    """One-time password codes for user verification."""
    __tablename__ = "otp_codes"
    __table_args__ = (
        Index("ix_otp_codes_user_id", "user_id"),
        Index("ix_otp_codes_code", "code"),
        Index("ix_otp_codes_expires_at", "expires_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    code: Mapped[str] = mapped_column(String(6), nullable=False)
    purpose: Mapped[str] = mapped_column(String(50), nullable=False, default="registration")
    is_used: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    user: Mapped["User"] = relationship(back_populates="otp_codes")


class VerificationCase(Base):
    """KYC verification case for patent submitters (human-review pipeline)."""
    __tablename__ = "verification_cases"
    __table_args__ = (
        Index("ix_verification_cases_user_id", "user_id"),
        Index("ix_verification_cases_status", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    # Patent DB lookup data
    patent_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    patent_address: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    # User-provided data
    user_address: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    id_document_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    selfie_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    # Review data
    status: Mapped[str] = mapped_column(
        SAEnum(*[s.value for s in VerificationStatus], name="verification_status"),
        nullable=False,
        default=VerificationStatus.not_started,
    )
    reviewer_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reviewed_by: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, nullable=True)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )

    user: Mapped["User"] = relationship(back_populates="verification_cases")
