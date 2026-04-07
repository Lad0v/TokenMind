import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.blockchain import (
    BlockchainOperation,
    BlockchainSyncStatus,
    BlockchainTxStatus,
    ListingStatus,
    TokenizedAssetStatus,
)


class ClaimSnapshotResponse(BaseModel):
    id: uuid.UUID
    patent_number: str
    patent_title: str | None
    claimed_owner_name: str
    jurisdiction: str | None
    status: str


class BlockchainContextResponse(BaseModel):
    network: str
    program_id: str
    platform_treasury_address: str
    rpc_url: str
    commitment: str


class TokenizationPrepareRequest(BaseModel):
    claim_id: uuid.UUID
    total_shares: int = Field(gt=0)
    sale_supply: int = Field(gt=0)
    issuer_reserve: int = Field(ge=0)
    platform_reserve: int = Field(ge=0)
    revoke_mint_authority: bool = False

    @model_validator(mode="after")
    def validate_allocations(self) -> "TokenizationPrepareRequest":
        total_allocated = self.sale_supply + self.issuer_reserve + self.platform_reserve
        if total_allocated != self.total_shares:
            raise ValueError("sale_supply + issuer_reserve + platform_reserve must equal total_shares")
        return self


class ListingPrepareRequest(BaseModel):
    client_request_id: str = Field(min_length=8, max_length=128)
    price_per_share_lamports: int = Field(gt=0)
    start_ts: datetime
    end_ts: datetime
    platform_fee_bps: int = Field(ge=0, le=10_000)

    @model_validator(mode="after")
    def validate_window(self) -> "ListingPrepareRequest":
        if self.start_ts >= self.end_ts:
            raise ValueError("start_ts must be before end_ts")
        return self


class ListingActionPrepareRequest(BaseModel):
    client_request_id: str = Field(min_length=8, max_length=128)


class PurchasePrepareRequest(BaseModel):
    client_request_id: str = Field(min_length=8, max_length=128)
    qty: int = Field(gt=0)


class TransactionSubmitRequest(BaseModel):
    tx_signature: str = Field(min_length=16, max_length=128)
    wallet_address: str = Field(min_length=32, max_length=64)
    asset_config_address: str | None = Field(default=None, min_length=32, max_length=64)
    mint_address: str | None = Field(default=None, min_length=32, max_length=64)
    fraction_config_address: str | None = Field(default=None, min_length=32, max_length=64)
    listing_address: str | None = Field(default=None, min_length=32, max_length=64)
    sale_vault_address: str | None = Field(default=None, min_length=32, max_length=64)
    trade_receipt_address: str | None = Field(default=None, min_length=32, max_length=64)
    trade_index: int | None = Field(default=None, ge=0)

    @field_validator(
        "tx_signature",
        "wallet_address",
        "asset_config_address",
        "mint_address",
        "fraction_config_address",
        "listing_address",
        "sale_vault_address",
        "trade_receipt_address",
    )
    @classmethod
    def trim_addresses(cls, value: str | None) -> str | None:
        if value is None:
            return value
        return value.strip()


class AssetListingResponse(BaseModel):
    id: uuid.UUID
    listing_address: str | None
    sale_vault_address: str | None
    platform_treasury_address: str
    price_per_share_lamports: int
    remaining_supply: int | None
    start_ts: datetime
    end_ts: datetime
    platform_fee_bps: int
    trade_count: int
    status: ListingStatus
    sync_status: BlockchainSyncStatus
    last_error: str | None
    created_at: datetime
    updated_at: datetime


class TokenizedAssetResponse(BaseModel):
    id: uuid.UUID
    issuer_user_id: uuid.UUID
    issuer_wallet_address: str
    asset_id: str
    asset_config_address: str | None
    mint_address: str | None
    fraction_config_address: str | None
    total_shares: int
    sale_supply: int
    issuer_reserve: int
    platform_reserve: int
    revoke_mint_authority_requested: bool
    mint_authority_revoked: bool
    status: TokenizedAssetStatus
    last_completed_operation: BlockchainOperation | None
    sync_status: BlockchainSyncStatus
    last_error: str | None
    claim: ClaimSnapshotResponse
    listing: AssetListingResponse | None
    created_at: datetime
    updated_at: datetime


class TokenizedAssetListResponse(BaseModel):
    items: list[TokenizedAssetResponse]


class BlockchainTransactionResponse(BaseModel):
    id: uuid.UUID
    operation: BlockchainOperation
    status: BlockchainTxStatus
    wallet_address: str
    client_request_id: str | None
    tx_signature: str | None
    trade_receipt_address: str | None
    trade_index: int | None
    quantity: int | None
    gross_amount_lamports: int | None
    fee_amount_lamports: int | None
    net_amount_lamports: int | None
    error_message: str | None
    submitted_at: datetime | None
    confirmed_at: datetime | None
    created_at: datetime


class TokenizationPrepareResponse(BaseModel):
    tokenization: TokenizedAssetResponse
    context: BlockchainContextResponse
    steps: list[BlockchainOperation]
    revoke_mint_authority_after_mint: bool


class TokenizationTransactionResponse(BaseModel):
    tokenization: TokenizedAssetResponse
    transaction: BlockchainTransactionResponse
    context: BlockchainContextResponse


class ListingPrepareResponse(BaseModel):
    tokenization: TokenizedAssetResponse
    listing: AssetListingResponse
    transaction: BlockchainTransactionResponse
    context: BlockchainContextResponse


class ListingTransactionResponse(BaseModel):
    tokenization: TokenizedAssetResponse
    listing: AssetListingResponse
    transaction: BlockchainTransactionResponse
    context: BlockchainContextResponse


class ListingActionPrepareResponse(BaseModel):
    listing: AssetListingResponse
    transaction: BlockchainTransactionResponse
    context: BlockchainContextResponse


class PurchaseTransactionResponse(BaseModel):
    listing: AssetListingResponse
    transaction: BlockchainTransactionResponse
    context: BlockchainContextResponse


class PurchasePrepareResponse(BaseModel):
    listing: AssetListingResponse
    transaction: BlockchainTransactionResponse
    context: BlockchainContextResponse


class MarketplaceListingResponse(BaseModel):
    listing: AssetListingResponse
    tokenization: TokenizedAssetResponse
    issuer_name: str | None


class MarketplaceListingListResponse(BaseModel):
    items: list[MarketplaceListingResponse]


class PortfolioHoldingResponse(BaseModel):
    tokenization_id: uuid.UUID
    asset_name: str
    patent_number: str
    quantity: int
    average_price_lamports: int
    current_price_lamports: int | None
    invested_lamports: int
    current_value_lamports: int | None
    listing_status: ListingStatus | None
    mint_address: str | None


class PortfolioHoldingListResponse(BaseModel):
    items: list[PortfolioHoldingResponse]


class TradeHistoryItemResponse(BaseModel):
    transaction: BlockchainTransactionResponse
    asset_name: str
    patent_number: str
    mint_address: str | None


class TradeHistoryResponse(BaseModel):
    items: list[TradeHistoryItemResponse]
