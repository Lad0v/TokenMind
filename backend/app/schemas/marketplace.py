import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class MarketplaceStatsResponse(BaseModel):
    active_listings: int
    total_available_tokens: int
    total_volume_sol: float
    floor_price_sol: Optional[float] = None


class MarketplaceListingRead(BaseModel):
    id: uuid.UUID
    claim_id: Optional[uuid.UUID] = None
    created_by_user_id: Optional[uuid.UUID] = None
    title: str
    patent_number: str
    description: Optional[str] = None
    issuer_name: str
    category: Optional[str] = None
    jurisdiction: Optional[str] = None
    token_symbol: str
    token_name: Optional[str] = None
    price_per_token_sol: float
    total_tokens: int
    available_tokens: int
    settlement_currency: str
    network: str
    treasury_wallet_address: str
    mint_address: Optional[str] = None
    external_metadata: Optional[dict] = None
    status: str
    created_at: datetime
    updated_at: datetime
    sold_tokens: int = 0
    purchase_count: int = 0
    volume_sol: float = 0

    model_config = {"from_attributes": True}


class MarketplaceListingListResponse(BaseModel):
    total: int
    stats: MarketplaceStatsResponse
    items: list[MarketplaceListingRead]


class CreateMarketplaceListingRequest(BaseModel):
    claim_id: Optional[uuid.UUID] = None
    title: str = Field(min_length=3, max_length=255)
    patent_number: str = Field(min_length=3, max_length=100)
    description: Optional[str] = None
    issuer_name: str = Field(min_length=2, max_length=255)
    category: Optional[str] = Field(default=None, max_length=120)
    jurisdiction: Optional[str] = Field(default=None, max_length=64)
    token_symbol: str = Field(min_length=2, max_length=16)
    token_name: Optional[str] = Field(default=None, max_length=120)
    price_per_token_sol: float = Field(gt=0)
    total_tokens: int = Field(gt=0, le=1_000_000)
    network: str = "solana-devnet"
    treasury_wallet_address: Optional[str] = None
    mint_address: Optional[str] = None
    external_metadata: Optional[dict] = None

    @field_validator("token_symbol")
    @classmethod
    def normalize_symbol(cls, value: str) -> str:
        return value.strip().upper()

    @field_validator("network")
    @classmethod
    def normalize_network(cls, value: str) -> str:
        return value.strip().lower()


class CreateMarketplacePurchaseRequest(BaseModel):
    listing_id: uuid.UUID
    quantity: int = Field(gt=0, le=1_000_000)


class ConfirmMarketplacePurchaseRequest(BaseModel):
    tx_signature: str = Field(min_length=20, max_length=128)

    @field_validator("tx_signature")
    @classmethod
    def normalize_signature(cls, value: str) -> str:
        return value.strip()


class MarketplaceTransactionRequest(BaseModel):
    network: str
    rpc_url: str
    treasury_wallet_address: str
    purchaser_wallet_address: str
    amount_sol: float
    amount_lamports: int
    expires_at: datetime


class MarketplacePurchaseRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    listing_id: uuid.UUID
    quantity: int
    price_per_token_sol: float
    quoted_total_sol: float
    total_sol: float
    expected_lamports: int
    payment_wallet_address: str
    treasury_wallet_address: str
    reference_code: str
    tx_signature: Optional[str] = None
    status: str
    failure_reason: Optional[str] = None
    payment_metadata: Optional[dict] = None
    expires_at: datetime
    confirmed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    listing: MarketplaceListingRead

    model_config = {"from_attributes": True}


class MarketplacePurchaseIntentResponse(BaseModel):
    purchase: MarketplacePurchaseRead
    transaction: MarketplaceTransactionRequest


class MarketplacePurchaseHistoryResponse(BaseModel):
    total: int
    items: list[MarketplacePurchaseRead]


class MarketplaceHoldingRead(BaseModel):
    listing_id: uuid.UUID
    title: str
    patent_number: str
    issuer_name: str
    token_symbol: str
    quantity: int
    avg_price_per_token_sol: float
    invested_sol: float
    latest_price_per_token_sol: float
    current_value_sol: float
    network: str
    settlement_currency: str
    status: str


class MarketplacePortfolioSummary(BaseModel):
    total_positions: int
    total_tokens: int
    invested_sol: float
    current_value_sol: float


class MarketplaceHoldingsResponse(BaseModel):
    summary: MarketplacePortfolioSummary
    items: list[MarketplaceHoldingRead]
