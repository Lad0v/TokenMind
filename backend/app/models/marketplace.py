import enum
import uuid
from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING

from sqlalchemy import (
    JSON,
    DateTime,
    Enum as SAEnum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.ip_claim import IpClaim
    from app.models.user import User


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class MarketplaceListingStatus(str, enum.Enum):
    draft = "draft"
    active = "active"
    paused = "paused"
    sold_out = "sold_out"
    archived = "archived"


class MarketplacePurchaseStatus(str, enum.Enum):
    pending_payment = "pending_payment"
    confirmed = "confirmed"
    failed = "failed"
    cancelled = "cancelled"
    expired = "expired"


class MarketplaceListing(Base):
    __tablename__ = "marketplace_listings"
    __table_args__ = (
        Index("ix_marketplace_listings_status", "status"),
        Index("ix_marketplace_listings_claim_id", "claim_id"),
        Index("ix_marketplace_listings_created_by_user_id", "created_by_user_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    claim_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid,
        ForeignKey("ip_claims.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    patent_number: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    issuer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    jurisdiction: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    token_symbol: Mapped[str] = mapped_column(String(16), nullable=False)
    token_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    price_per_token_sol: Mapped[float] = mapped_column(Float, nullable=False)
    total_tokens: Mapped[int] = mapped_column(Integer, nullable=False)
    available_tokens: Mapped[int] = mapped_column(Integer, nullable=False)
    settlement_currency: Mapped[str] = mapped_column(String(16), nullable=False, default="SOL")
    network: Mapped[str] = mapped_column(String(64), nullable=False, default="solana-devnet")
    treasury_wallet_address: Mapped[str] = mapped_column(String(100), nullable=False)
    mint_address: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    external_metadata: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(
        SAEnum(*[status.value for status in MarketplaceListingStatus], name="marketplace_listing_status"),
        nullable=False,
        default=MarketplaceListingStatus.active,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=_utcnow,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=_utcnow,
        onupdate=_utcnow,
    )

    claim: Mapped[Optional["IpClaim"]] = relationship("IpClaim")
    creator: Mapped[Optional["User"]] = relationship("User")
    purchases: Mapped[list["MarketplacePurchase"]] = relationship(
        back_populates="listing",
        cascade="all, delete-orphan",
    )


class MarketplacePurchase(Base):
    __tablename__ = "marketplace_purchases"
    __table_args__ = (
        Index("ix_marketplace_purchases_user_id", "user_id"),
        Index("ix_marketplace_purchases_listing_id", "listing_id"),
        Index("ix_marketplace_purchases_status", "status"),
        Index("ix_marketplace_purchases_created_at", "created_at"),
        Index("ix_marketplace_purchases_expires_at", "expires_at"),
        Index("ix_marketplace_purchases_tx_signature", "tx_signature"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    listing_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("marketplace_listings.id", ondelete="CASCADE"),
        nullable=False,
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    price_per_token_sol: Mapped[float] = mapped_column(Float, nullable=False)
    quoted_total_sol: Mapped[float] = mapped_column(Float, nullable=False)
    total_sol: Mapped[float] = mapped_column(Float, nullable=False)
    expected_lamports: Mapped[int] = mapped_column(Integer, nullable=False)
    payment_wallet_address: Mapped[str] = mapped_column(String(100), nullable=False)
    treasury_wallet_address: Mapped[str] = mapped_column(String(100), nullable=False)
    reference_code: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    tx_signature: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, unique=True)
    status: Mapped[str] = mapped_column(
        SAEnum(*[status.value for status in MarketplacePurchaseStatus], name="marketplace_purchase_status"),
        nullable=False,
        default=MarketplacePurchaseStatus.pending_payment,
    )
    failure_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    payment_metadata: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=_utcnow,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=_utcnow,
        onupdate=_utcnow,
    )

    user: Mapped["User"] = relationship("User")
    listing: Mapped["MarketplaceListing"] = relationship(back_populates="purchases")
