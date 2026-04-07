import enum
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class TokenizedAssetStatus(str, enum.Enum):
    draft = "draft"
    asset_initialized = "asset_initialized"
    minted = "minted"
    mint_authority_revoked = "mint_authority_revoked"
    fraction_configured = "fraction_configured"
    sale_supply_deposited = "sale_supply_deposited"
    fraction_model_locked = "fraction_model_locked"
    listed = "listed"
    paused = "paused"
    closed = "closed"
    failed = "failed"


class ListingStatus(str, enum.Enum):
    draft = "draft"
    active = "active"
    paused = "paused"
    closed = "closed"
    sold_out = "sold_out"
    failed = "failed"


class BlockchainSyncStatus(str, enum.Enum):
    pending = "pending"
    synced = "synced"
    failed = "failed"


class BlockchainTxStatus(str, enum.Enum):
    prepared = "prepared"
    submitted = "submitted"
    confirmed = "confirmed"
    failed = "failed"


class BlockchainOperation(str, enum.Enum):
    initialize_asset = "initialize_asset"
    mint_asset_tokens = "mint_asset_tokens"
    revoke_mint_authority = "revoke_mint_authority"
    configure_fractionalization = "configure_fractionalization"
    deposit_sale_supply = "deposit_sale_supply"
    lock_fraction_model = "lock_fraction_model"
    create_listing = "create_listing"
    buy_shares = "buy_shares"
    pause_listing = "pause_listing"
    close_listing = "close_listing"


class TokenizedAsset(Base):
    __tablename__ = "tokenized_assets"
    __table_args__ = (
        UniqueConstraint("ip_claim_id", name="uq_tokenized_assets_ip_claim"),
        UniqueConstraint("asset_id", name="uq_tokenized_assets_asset_id"),
        Index("ix_tokenized_assets_issuer", "issuer_user_id"),
        Index("ix_tokenized_assets_status", "status"),
        Index("ix_tokenized_assets_sync_status", "sync_status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    ip_claim_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("ip_claims.id", ondelete="RESTRICT"), nullable=False
    )
    issuer_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    issuer_wallet_address: Mapped[str] = mapped_column(String(100), nullable=False)
    asset_id: Mapped[str] = mapped_column(String(32), nullable=False)
    asset_config_address: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    mint_address: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    fraction_config_address: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    total_shares: Mapped[int] = mapped_column(BigInteger, nullable=False)
    sale_supply: Mapped[int] = mapped_column(BigInteger, nullable=False)
    issuer_reserve: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    platform_reserve: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    revoke_mint_authority_requested: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    mint_authority_revoked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[str] = mapped_column(
        String(64), nullable=False, default=TokenizedAssetStatus.draft.value
    )
    last_completed_operation: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    sync_status: Mapped[str] = mapped_column(
        String(32), nullable=False, default=BlockchainSyncStatus.pending.value
    )
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_snapshot: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    chain_snapshot: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    last_synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )

    ip_claim = relationship("IpClaim")
    issuer = relationship("User")
    listing = relationship("AssetListing", uselist=False, back_populates="tokenized_asset")
    transactions = relationship("BlockchainTransaction", back_populates="tokenized_asset")


class AssetListing(Base):
    __tablename__ = "asset_listings"
    __table_args__ = (
        UniqueConstraint("tokenized_asset_id", name="uq_asset_listings_tokenized_asset"),
        UniqueConstraint("listing_address", name="uq_asset_listings_address"),
        Index("ix_asset_listings_status", "status"),
        Index("ix_asset_listings_sync_status", "sync_status"),
        Index("ix_asset_listings_window", "start_ts", "end_ts"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tokenized_asset_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("tokenized_assets.id", ondelete="CASCADE"), nullable=False
    )
    listing_address: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    sale_vault_address: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    platform_treasury_address: Mapped[str] = mapped_column(String(64), nullable=False)
    price_per_share_lamports: Mapped[int] = mapped_column(BigInteger, nullable=False)
    remaining_supply: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    start_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    platform_fee_bps: Mapped[int] = mapped_column(nullable=False)
    trade_count: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default=ListingStatus.draft.value
    )
    sync_status: Mapped[str] = mapped_column(
        String(32), nullable=False, default=BlockchainSyncStatus.pending.value
    )
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    last_synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )

    tokenized_asset = relationship("TokenizedAsset", back_populates="listing")
    transactions = relationship("BlockchainTransaction", back_populates="listing")


class BlockchainTransaction(Base):
    __tablename__ = "blockchain_transactions"
    __table_args__ = (
        UniqueConstraint("client_request_id", name="uq_blockchain_transactions_client_request"),
        UniqueConstraint("tx_signature", name="uq_blockchain_transactions_signature"),
        Index("ix_blockchain_transactions_user_operation", "user_id", "operation"),
        Index("ix_blockchain_transactions_asset_status", "tokenized_asset_id", "status"),
        Index("ix_blockchain_transactions_listing_status", "listing_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tokenized_asset_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("tokenized_assets.id", ondelete="CASCADE"), nullable=True
    )
    listing_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("asset_listings.id", ondelete="CASCADE"), nullable=True
    )
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    operation: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default=BlockchainTxStatus.prepared.value
    )
    wallet_address: Mapped[str] = mapped_column(String(100), nullable=False)
    client_request_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    tx_signature: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    trade_receipt_address: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    trade_index: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    quantity: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    gross_amount_lamports: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    fee_amount_lamports: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    net_amount_lamports: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    response_payload: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )

    tokenized_asset = relationship("TokenizedAsset", back_populates="transactions")
    listing = relationship("AssetListing", back_populates="transactions")
    user = relationship("User")
