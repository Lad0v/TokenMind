"""blockchain integration mirror tables

Revision ID: 20260407_0001
Revises:
Create Date: 2026-04-07 00:01:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260407_0001"
down_revision = "138dcbc0afd4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tokenized_assets",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("ip_claim_id", sa.Uuid(), nullable=False),
        sa.Column("issuer_user_id", sa.Uuid(), nullable=False),
        sa.Column("issuer_wallet_address", sa.String(length=100), nullable=False),
        sa.Column("asset_id", sa.String(length=32), nullable=False),
        sa.Column("asset_config_address", sa.String(length=64), nullable=True),
        sa.Column("mint_address", sa.String(length=64), nullable=True),
        sa.Column("fraction_config_address", sa.String(length=64), nullable=True),
        sa.Column("total_shares", sa.BigInteger(), nullable=False),
        sa.Column("sale_supply", sa.BigInteger(), nullable=False),
        sa.Column("issuer_reserve", sa.BigInteger(), nullable=False),
        sa.Column("platform_reserve", sa.BigInteger(), nullable=False),
        sa.Column("revoke_mint_authority_requested", sa.Boolean(), nullable=False),
        sa.Column("mint_authority_revoked", sa.Boolean(), nullable=False),
        sa.Column("status", sa.String(length=64), nullable=False),
        sa.Column("last_completed_operation", sa.String(length=64), nullable=True),
        sa.Column("sync_status", sa.String(length=32), nullable=False),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("metadata_snapshot", sa.JSON(), nullable=True),
        sa.Column("chain_snapshot", sa.JSON(), nullable=True),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["ip_claim_id"], ["ip_claims.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["issuer_user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("asset_id", name="uq_tokenized_assets_asset_id"),
        sa.UniqueConstraint("ip_claim_id", name="uq_tokenized_assets_ip_claim"),
    )
    op.create_index("ix_tokenized_assets_issuer", "tokenized_assets", ["issuer_user_id"])
    op.create_index("ix_tokenized_assets_status", "tokenized_assets", ["status"])
    op.create_index("ix_tokenized_assets_sync_status", "tokenized_assets", ["sync_status"])

    op.create_table(
        "asset_listings",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tokenized_asset_id", sa.Uuid(), nullable=False),
        sa.Column("listing_address", sa.String(length=64), nullable=True),
        sa.Column("sale_vault_address", sa.String(length=64), nullable=True),
        sa.Column("platform_treasury_address", sa.String(length=64), nullable=False),
        sa.Column("price_per_share_lamports", sa.BigInteger(), nullable=False),
        sa.Column("remaining_supply", sa.BigInteger(), nullable=True),
        sa.Column("start_ts", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_ts", sa.DateTime(timezone=True), nullable=False),
        sa.Column("platform_fee_bps", sa.Integer(), nullable=False),
        sa.Column("trade_count", sa.BigInteger(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("sync_status", sa.String(length=32), nullable=False),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["tokenized_asset_id"], ["tokenized_assets.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("listing_address", name="uq_asset_listings_address"),
        sa.UniqueConstraint("tokenized_asset_id", name="uq_asset_listings_tokenized_asset"),
    )
    op.create_index("ix_asset_listings_status", "asset_listings", ["status"])
    op.create_index("ix_asset_listings_sync_status", "asset_listings", ["sync_status"])
    op.create_index("ix_asset_listings_window", "asset_listings", ["start_ts", "end_ts"])

    op.create_table(
        "blockchain_transactions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tokenized_asset_id", sa.Uuid(), nullable=True),
        sa.Column("listing_id", sa.Uuid(), nullable=True),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("operation", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("wallet_address", sa.String(length=100), nullable=False),
        sa.Column("client_request_id", sa.String(length=128), nullable=True),
        sa.Column("tx_signature", sa.String(length=128), nullable=True),
        sa.Column("trade_receipt_address", sa.String(length=64), nullable=True),
        sa.Column("trade_index", sa.BigInteger(), nullable=True),
        sa.Column("quantity", sa.BigInteger(), nullable=True),
        sa.Column("gross_amount_lamports", sa.BigInteger(), nullable=True),
        sa.Column("fee_amount_lamports", sa.BigInteger(), nullable=True),
        sa.Column("net_amount_lamports", sa.BigInteger(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("response_payload", sa.JSON(), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["listing_id"], ["asset_listings.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tokenized_asset_id"], ["tokenized_assets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("client_request_id", name="uq_blockchain_transactions_client_request"),
        sa.UniqueConstraint("tx_signature", name="uq_blockchain_transactions_signature"),
    )
    op.create_index(
        "ix_blockchain_transactions_user_operation",
        "blockchain_transactions",
        ["user_id", "operation"],
    )
    op.create_index(
        "ix_blockchain_transactions_asset_status",
        "blockchain_transactions",
        ["tokenized_asset_id", "status"],
    )
    op.create_index(
        "ix_blockchain_transactions_listing_status",
        "blockchain_transactions",
        ["listing_id", "status"],
    )


def downgrade() -> None:
    op.drop_index("ix_blockchain_transactions_listing_status", table_name="blockchain_transactions")
    op.drop_index("ix_blockchain_transactions_asset_status", table_name="blockchain_transactions")
    op.drop_index("ix_blockchain_transactions_user_operation", table_name="blockchain_transactions")
    op.drop_table("blockchain_transactions")

    op.drop_index("ix_asset_listings_window", table_name="asset_listings")
    op.drop_index("ix_asset_listings_sync_status", table_name="asset_listings")
    op.drop_index("ix_asset_listings_status", table_name="asset_listings")
    op.drop_table("asset_listings")

    op.drop_index("ix_tokenized_assets_sync_status", table_name="tokenized_assets")
    op.drop_index("ix_tokenized_assets_status", table_name="tokenized_assets")
    op.drop_index("ix_tokenized_assets_issuer", table_name="tokenized_assets")
    op.drop_table("tokenized_assets")
