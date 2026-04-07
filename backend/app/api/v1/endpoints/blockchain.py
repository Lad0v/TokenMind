import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.blockchain.dependencies import get_blockchain_client
from app.blockchain.client import SolanaBlockchainClient
from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.blockchain import AssetListing, BlockchainOperation, BlockchainTransaction, TokenizedAsset
from app.models.user import User, UserRole
from app.schemas.blockchain import (
    AssetListingResponse,
    BlockchainContextResponse,
    BlockchainTransactionResponse,
    ClaimSnapshotResponse,
    ListingActionPrepareRequest,
    ListingActionPrepareResponse,
    ListingPrepareRequest,
    ListingPrepareResponse,
    ListingTransactionResponse,
    MarketplaceListingListResponse,
    MarketplaceListingResponse,
    PortfolioHoldingListResponse,
    PurchasePrepareRequest,
    PurchasePrepareResponse,
    PurchaseTransactionResponse,
    TokenizationPrepareRequest,
    TokenizationPrepareResponse,
    TokenizationTransactionResponse,
    TokenizedAssetListResponse,
    TokenizedAssetResponse,
    TradeHistoryItemResponse,
    TradeHistoryResponse,
    TransactionSubmitRequest,
)
from app.services.listing_service import ListingService
from app.services.purchase_service import PurchaseService
from app.services.tokenization_service import TokenizationService

router = APIRouter()


def _build_context() -> BlockchainContextResponse:
    return BlockchainContextResponse(
        network=settings.SOLANA_NETWORK,
        program_id=settings.SOLANA_PROGRAM_ID,
        platform_treasury_address=settings.SOLANA_PLATFORM_TREASURY,
        rpc_url=settings.SOLANA_RPC_URL,
        commitment=settings.SOLANA_COMMITMENT,
    )


def _build_claim_response(asset: TokenizedAsset) -> ClaimSnapshotResponse:
    claim = asset.ip_claim
    return ClaimSnapshotResponse(
        id=claim.id,
        patent_number=claim.patent_number,
        patent_title=claim.patent_title,
        claimed_owner_name=claim.claimed_owner_name,
        jurisdiction=claim.jurisdiction,
        status=claim.status,
    )


def _build_listing_response(listing: AssetListing) -> AssetListingResponse:
    return AssetListingResponse(
        id=listing.id,
        listing_address=listing.listing_address,
        sale_vault_address=listing.sale_vault_address,
        platform_treasury_address=listing.platform_treasury_address,
        price_per_share_lamports=listing.price_per_share_lamports,
        remaining_supply=listing.remaining_supply,
        start_ts=listing.start_ts,
        end_ts=listing.end_ts,
        platform_fee_bps=listing.platform_fee_bps,
        trade_count=listing.trade_count,
        status=listing.status,
        sync_status=listing.sync_status,
        last_error=listing.last_error,
        created_at=listing.created_at,
        updated_at=listing.updated_at,
    )


def _build_asset_response(asset: TokenizedAsset) -> TokenizedAssetResponse:
    return TokenizedAssetResponse(
        id=asset.id,
        issuer_user_id=asset.issuer_user_id,
        issuer_wallet_address=asset.issuer_wallet_address,
        asset_id=asset.asset_id,
        asset_config_address=asset.asset_config_address,
        mint_address=asset.mint_address,
        fraction_config_address=asset.fraction_config_address,
        total_shares=asset.total_shares,
        sale_supply=asset.sale_supply,
        issuer_reserve=asset.issuer_reserve,
        platform_reserve=asset.platform_reserve,
        revoke_mint_authority_requested=asset.revoke_mint_authority_requested,
        mint_authority_revoked=asset.mint_authority_revoked,
        status=asset.status,
        last_completed_operation=asset.last_completed_operation,
        sync_status=asset.sync_status,
        last_error=asset.last_error,
        claim=_build_claim_response(asset),
        listing=_build_listing_response(asset.listing) if asset.listing else None,
        created_at=asset.created_at,
        updated_at=asset.updated_at,
    )


def _build_transaction_response(transaction: BlockchainTransaction) -> BlockchainTransactionResponse:
    return BlockchainTransactionResponse(
        id=transaction.id,
        operation=transaction.operation,
        status=transaction.status,
        wallet_address=transaction.wallet_address,
        client_request_id=transaction.client_request_id,
        tx_signature=transaction.tx_signature,
        trade_receipt_address=transaction.trade_receipt_address,
        trade_index=transaction.trade_index,
        quantity=transaction.quantity,
        gross_amount_lamports=transaction.gross_amount_lamports,
        fee_amount_lamports=transaction.fee_amount_lamports,
        net_amount_lamports=transaction.net_amount_lamports,
        error_message=transaction.error_message,
        submitted_at=transaction.submitted_at,
        confirmed_at=transaction.confirmed_at,
        created_at=transaction.created_at,
    )


@router.get("/tokenizations", response_model=TokenizedAssetListResponse)
async def list_my_tokenizations(
    current_user: User = Depends(require_roles(UserRole.issuer.value)),
    db: AsyncSession = Depends(get_db),
):
    items = await TokenizationService.list_issuer_assets(db, current_user.id)
    return TokenizedAssetListResponse(items=[_build_asset_response(item) for item in items])


@router.post("/tokenizations/prepare", response_model=TokenizationPrepareResponse)
async def prepare_tokenization(
    payload: TokenizationPrepareRequest,
    current_user: User = Depends(require_roles(UserRole.issuer.value)),
    db: AsyncSession = Depends(get_db),
):
    tokenization = await TokenizationService.prepare_tokenization(db, current_user, payload)
    return TokenizationPrepareResponse(
        tokenization=_build_asset_response(tokenization),
        context=_build_context(),
        steps=TokenizationService.TOKENIZATION_STEPS,
        revoke_mint_authority_after_mint=payload.revoke_mint_authority,
    )


@router.get("/tokenizations/{tokenization_id}", response_model=TokenizedAssetResponse)
async def get_tokenization(
    tokenization_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tokenization = await TokenizationService.get_asset_for_user(db, current_user, tokenization_id)
    return _build_asset_response(tokenization)


@router.get("/tokenizations/{tokenization_id}/status", response_model=TokenizedAssetResponse)
async def get_tokenization_status(
    tokenization_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tokenization = await TokenizationService.get_asset_for_user(db, current_user, tokenization_id)
    return _build_asset_response(tokenization)


@router.post(
    "/tokenizations/{tokenization_id}/steps/{operation}/submit",
    response_model=TokenizationTransactionResponse,
)
async def submit_tokenization_step(
    tokenization_id: uuid.UUID,
    operation: BlockchainOperation,
    payload: TransactionSubmitRequest,
    current_user: User = Depends(require_roles(UserRole.issuer.value)),
    db: AsyncSession = Depends(get_db),
    client: SolanaBlockchainClient = Depends(get_blockchain_client),
):
    tokenization, transaction = await TokenizationService.submit_step(
        db,
        current_user,
        tokenization_id,
        operation,
        payload,
        client,
    )
    return TokenizationTransactionResponse(
        tokenization=_build_asset_response(tokenization),
        transaction=_build_transaction_response(transaction),
        context=_build_context(),
    )


@router.post(
    "/tokenizations/{tokenization_id}/listing/prepare",
    response_model=ListingPrepareResponse,
)
async def prepare_listing(
    tokenization_id: uuid.UUID,
    payload: ListingPrepareRequest,
    current_user: User = Depends(require_roles(UserRole.issuer.value)),
    db: AsyncSession = Depends(get_db),
):
    tokenization, listing, transaction = await ListingService.prepare_listing(
        db,
        current_user,
        tokenization_id,
        payload,
    )
    return ListingPrepareResponse(
        tokenization=_build_asset_response(tokenization),
        listing=_build_listing_response(listing),
        transaction=_build_transaction_response(transaction),
        context=_build_context(),
    )


@router.post(
    "/tokenizations/{tokenization_id}/listing/submit",
    response_model=ListingTransactionResponse,
)
async def submit_listing(
    tokenization_id: uuid.UUID,
    payload: TransactionSubmitRequest,
    current_user: User = Depends(require_roles(UserRole.issuer.value)),
    db: AsyncSession = Depends(get_db),
    client: SolanaBlockchainClient = Depends(get_blockchain_client),
):
    tokenization, listing, transaction = await ListingService.submit_listing(
        db,
        current_user,
        tokenization_id,
        payload,
        client,
    )
    return ListingTransactionResponse(
        tokenization=_build_asset_response(tokenization),
        listing=_build_listing_response(listing),
        transaction=_build_transaction_response(transaction),
        context=_build_context(),
    )


@router.post(
    "/listings/{listing_id}/pause/prepare",
    response_model=ListingActionPrepareResponse,
)
async def prepare_pause_listing(
    listing_id: uuid.UUID,
    payload: ListingActionPrepareRequest,
    current_user: User = Depends(require_roles(UserRole.issuer.value)),
    db: AsyncSession = Depends(get_db),
):
    listing, transaction = await ListingService.prepare_listing_action(
        db,
        current_user,
        listing_id,
        BlockchainOperation.pause_listing,
        payload,
    )
    return ListingActionPrepareResponse(
        listing=_build_listing_response(listing),
        transaction=_build_transaction_response(transaction),
        context=_build_context(),
    )


@router.post(
    "/listings/{listing_id}/pause/submit",
    response_model=ListingActionPrepareResponse,
)
async def submit_pause_listing(
    listing_id: uuid.UUID,
    payload: TransactionSubmitRequest,
    current_user: User = Depends(require_roles(UserRole.issuer.value)),
    db: AsyncSession = Depends(get_db),
    client: SolanaBlockchainClient = Depends(get_blockchain_client),
):
    listing, transaction = await ListingService.submit_listing_action(
        db,
        current_user,
        listing_id,
        BlockchainOperation.pause_listing,
        payload,
        client,
    )
    return ListingActionPrepareResponse(
        listing=_build_listing_response(listing),
        transaction=_build_transaction_response(transaction),
        context=_build_context(),
    )


@router.post(
    "/listings/{listing_id}/close/prepare",
    response_model=ListingActionPrepareResponse,
)
async def prepare_close_listing(
    listing_id: uuid.UUID,
    payload: ListingActionPrepareRequest,
    current_user: User = Depends(require_roles(UserRole.issuer.value)),
    db: AsyncSession = Depends(get_db),
):
    listing, transaction = await ListingService.prepare_listing_action(
        db,
        current_user,
        listing_id,
        BlockchainOperation.close_listing,
        payload,
    )
    return ListingActionPrepareResponse(
        listing=_build_listing_response(listing),
        transaction=_build_transaction_response(transaction),
        context=_build_context(),
    )


@router.post(
    "/listings/{listing_id}/close/submit",
    response_model=ListingActionPrepareResponse,
)
async def submit_close_listing(
    listing_id: uuid.UUID,
    payload: TransactionSubmitRequest,
    current_user: User = Depends(require_roles(UserRole.issuer.value)),
    db: AsyncSession = Depends(get_db),
    client: SolanaBlockchainClient = Depends(get_blockchain_client),
):
    listing, transaction = await ListingService.submit_listing_action(
        db,
        current_user,
        listing_id,
        BlockchainOperation.close_listing,
        payload,
        client,
    )
    return ListingActionPrepareResponse(
        listing=_build_listing_response(listing),
        transaction=_build_transaction_response(transaction),
        context=_build_context(),
    )


@router.get("/marketplace/listings", response_model=MarketplaceListingListResponse)
async def list_marketplace(
    search: str | None = Query(default=None, max_length=128),
    db: AsyncSession = Depends(get_db),
):
    listings = await ListingService.list_public_marketplace(db, search)
    return MarketplaceListingListResponse(
        items=[
            MarketplaceListingResponse(
                listing=_build_listing_response(listing),
                tokenization=_build_asset_response(listing.tokenized_asset),
                issuer_name=listing.tokenized_asset.ip_claim.claimed_owner_name,
            )
            for listing in listings
        ]
    )


@router.get("/marketplace/listings/{listing_id}", response_model=MarketplaceListingResponse)
async def get_marketplace_listing(
    listing_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    listing = await ListingService.get_listing_public(db, listing_id)
    return MarketplaceListingResponse(
        listing=_build_listing_response(listing),
        tokenization=_build_asset_response(listing.tokenized_asset),
        issuer_name=listing.tokenized_asset.ip_claim.claimed_owner_name,
    )


@router.post(
    "/listings/{listing_id}/purchase/prepare",
    response_model=PurchasePrepareResponse,
)
async def prepare_purchase(
    listing_id: uuid.UUID,
    payload: PurchasePrepareRequest,
    current_user: User = Depends(require_roles(UserRole.investor.value)),
    db: AsyncSession = Depends(get_db),
):
    listing, transaction = await PurchaseService.prepare_purchase(
        db,
        current_user,
        listing_id,
        payload,
    )
    return PurchasePrepareResponse(
        listing=_build_listing_response(listing),
        transaction=_build_transaction_response(transaction),
        context=_build_context(),
    )


@router.post("/purchases/{purchase_id}/submit", response_model=PurchaseTransactionResponse)
async def submit_purchase(
    purchase_id: uuid.UUID,
    payload: TransactionSubmitRequest,
    current_user: User = Depends(require_roles(UserRole.investor.value)),
    db: AsyncSession = Depends(get_db),
    client: SolanaBlockchainClient = Depends(get_blockchain_client),
):
    listing, transaction = await PurchaseService.submit_purchase(
        db,
        current_user,
        purchase_id,
        payload,
        client,
    )
    return PurchaseTransactionResponse(
        listing=_build_listing_response(listing),
        transaction=_build_transaction_response(transaction),
        context=_build_context(),
    )


@router.get("/portfolio/holdings", response_model=PortfolioHoldingListResponse)
async def get_portfolio_holdings(
    current_user: User = Depends(require_roles(UserRole.investor.value)),
    db: AsyncSession = Depends(get_db),
):
    holdings = await PurchaseService.get_holdings(db, current_user)
    return PortfolioHoldingListResponse(items=holdings)


@router.get("/portfolio/trades", response_model=TradeHistoryResponse)
async def get_portfolio_trades(
    current_user: User = Depends(require_roles(UserRole.investor.value)),
    db: AsyncSession = Depends(get_db),
):
    trades = await PurchaseService.get_trade_history(db, current_user)
    items = []
    for trade in trades:
        asset = trade.tokenized_asset
        claim = asset.ip_claim if asset else None
        items.append(
            TradeHistoryItemResponse(
                transaction=_build_transaction_response(trade),
                asset_name=(claim.patent_title or claim.patent_number) if claim else "Unknown asset",
                patent_number=claim.patent_number if claim else "—",
                mint_address=asset.mint_address if asset else None,
            )
        )
    return TradeHistoryResponse(items=items)
