"""add_marketplace_tables

Revision ID: c9f1a8d24b10
Revises: 138dcbc0afd4
Create Date: 2026-04-07 14:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "c9f1a8d24b10"
down_revision: Union[str, None] = "138dcbc0afd4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


LISTING_STATUS_ENUM = sa.Enum(
    "draft",
    "active",
    "paused",
    "sold_out",
    "archived",
    name="marketplace_listing_status",
)

PURCHASE_STATUS_ENUM = sa.Enum(
    "pending_payment",
    "confirmed",
    "failed",
    "cancelled",
    "expired",
    name="marketplace_purchase_status",
)

LISTING_STATUS_ENUM_COLUMN = postgresql.ENUM(
    "draft",
    "active",
    "paused",
    "sold_out",
    "archived",
    name="marketplace_listing_status",
    create_type=False,
)

PURCHASE_STATUS_ENUM_COLUMN = postgresql.ENUM(
    "pending_payment",
    "confirmed",
    "failed",
    "cancelled",
    "expired",
    name="marketplace_purchase_status",
    create_type=False,
)


def _table_exists(table_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return table_name in set(inspector.get_table_names())


def upgrade() -> None:
    bind = op.get_bind()

    LISTING_STATUS_ENUM.create(bind, checkfirst=True)
    PURCHASE_STATUS_ENUM.create(bind, checkfirst=True)

    if not _table_exists("marketplace_listings"):
        op.create_table(
            "marketplace_listings",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("claim_id", sa.Uuid(), nullable=True),
            sa.Column("created_by_user_id", sa.Uuid(), nullable=True),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("patent_number", sa.String(length=100), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("issuer_name", sa.String(length=255), nullable=False),
            sa.Column("category", sa.String(length=120), nullable=True),
            sa.Column("jurisdiction", sa.String(length=64), nullable=True),
            sa.Column("token_symbol", sa.String(length=16), nullable=False),
            sa.Column("token_name", sa.String(length=120), nullable=True),
            sa.Column("price_per_token_sol", sa.Float(), nullable=False),
            sa.Column("total_tokens", sa.Integer(), nullable=False),
            sa.Column("available_tokens", sa.Integer(), nullable=False),
            sa.Column("settlement_currency", sa.String(length=16), nullable=False),
            sa.Column("network", sa.String(length=64), nullable=False),
            sa.Column("treasury_wallet_address", sa.String(length=100), nullable=False),
            sa.Column("mint_address", sa.String(length=100), nullable=True),
            sa.Column("external_metadata", sa.JSON(), nullable=True),
            sa.Column("status", LISTING_STATUS_ENUM_COLUMN, nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["claim_id"], ["ip_claims.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_marketplace_listings_claim_id", "marketplace_listings", ["claim_id"], unique=False)
        op.create_index(
            "ix_marketplace_listings_created_by_user_id",
            "marketplace_listings",
            ["created_by_user_id"],
            unique=False,
        )
        op.create_index("ix_marketplace_listings_status", "marketplace_listings", ["status"], unique=False)
        op.create_index("ix_marketplace_listings_patent_number", "marketplace_listings", ["patent_number"], unique=False)

    if not _table_exists("marketplace_purchases"):
        op.create_table(
            "marketplace_purchases",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("user_id", sa.Uuid(), nullable=False),
            sa.Column("listing_id", sa.Uuid(), nullable=False),
            sa.Column("quantity", sa.Integer(), nullable=False),
            sa.Column("price_per_token_sol", sa.Float(), nullable=False),
            sa.Column("quoted_total_sol", sa.Float(), nullable=False),
            sa.Column("total_sol", sa.Float(), nullable=False),
            sa.Column("expected_lamports", sa.Integer(), nullable=False),
            sa.Column("payment_wallet_address", sa.String(length=100), nullable=False),
            sa.Column("treasury_wallet_address", sa.String(length=100), nullable=False),
            sa.Column("reference_code", sa.String(length=64), nullable=False),
            sa.Column("tx_signature", sa.String(length=128), nullable=True),
            sa.Column("status", PURCHASE_STATUS_ENUM_COLUMN, nullable=False),
            sa.Column("failure_reason", sa.Text(), nullable=True),
            sa.Column("payment_metadata", sa.JSON(), nullable=True),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["listing_id"], ["marketplace_listings.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("reference_code"),
            sa.UniqueConstraint("tx_signature"),
        )
        op.create_index("ix_marketplace_purchases_created_at", "marketplace_purchases", ["created_at"], unique=False)
        op.create_index("ix_marketplace_purchases_expires_at", "marketplace_purchases", ["expires_at"], unique=False)
        op.create_index("ix_marketplace_purchases_listing_id", "marketplace_purchases", ["listing_id"], unique=False)
        op.create_index("ix_marketplace_purchases_status", "marketplace_purchases", ["status"], unique=False)
        op.create_index("ix_marketplace_purchases_tx_signature", "marketplace_purchases", ["tx_signature"], unique=False)
        op.create_index("ix_marketplace_purchases_user_id", "marketplace_purchases", ["user_id"], unique=False)
        op.create_index("ix_marketplace_purchases_reference_code", "marketplace_purchases", ["reference_code"], unique=True)


def downgrade() -> None:
    if _table_exists("marketplace_purchases"):
        op.drop_index("ix_marketplace_purchases_reference_code", table_name="marketplace_purchases")
        op.drop_index("ix_marketplace_purchases_user_id", table_name="marketplace_purchases")
        op.drop_index("ix_marketplace_purchases_tx_signature", table_name="marketplace_purchases")
        op.drop_index("ix_marketplace_purchases_status", table_name="marketplace_purchases")
        op.drop_index("ix_marketplace_purchases_listing_id", table_name="marketplace_purchases")
        op.drop_index("ix_marketplace_purchases_expires_at", table_name="marketplace_purchases")
        op.drop_index("ix_marketplace_purchases_created_at", table_name="marketplace_purchases")
        op.drop_table("marketplace_purchases")

    if _table_exists("marketplace_listings"):
        op.drop_index("ix_marketplace_listings_patent_number", table_name="marketplace_listings")
        op.drop_index("ix_marketplace_listings_status", table_name="marketplace_listings")
        op.drop_index("ix_marketplace_listings_created_by_user_id", table_name="marketplace_listings")
        op.drop_index("ix_marketplace_listings_claim_id", table_name="marketplace_listings")
        op.drop_table("marketplace_listings")

    bind = op.get_bind()
    PURCHASE_STATUS_ENUM.drop(bind, checkfirst=True)
    LISTING_STATUS_ENUM.drop(bind, checkfirst=True)
