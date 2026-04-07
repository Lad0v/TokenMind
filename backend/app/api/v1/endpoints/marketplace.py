import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.marketplace import MarketplacePurchaseStatus
from app.models.user import User
from app.schemas.marketplace import (
    ConfirmMarketplacePurchaseRequest,
    CreateMarketplaceListingRequest,
    CreateMarketplacePurchaseRequest,
    MarketplaceHoldingsResponse,
    MarketplaceListingListResponse,
    MarketplaceListingRead,
    MarketplacePortfolioSummary,
    MarketplacePurchaseHistoryResponse,
    MarketplacePurchaseIntentResponse,
    MarketplacePurchaseRead,
    MarketplaceStatsResponse,
)
from app.services.audit_service import AuditService
from app.services.marketplace_service import MarketplaceService

router = APIRouter()


def _build_listing_response(listing, metrics: dict | None = None) -> MarketplaceListingRead:
    metrics = metrics or {}
    sold_tokens = max(listing.total_tokens - listing.available_tokens, 0)
    return MarketplaceListingRead(
        id=listing.id,
        claim_id=listing.claim_id,
        created_by_user_id=listing.created_by_user_id,
        title=listing.title,
        patent_number=listing.patent_number,
        description=listing.description,
        issuer_name=listing.issuer_name,
        category=listing.category,
        jurisdiction=listing.jurisdiction,
        token_symbol=listing.token_symbol,
        token_name=listing.token_name,
        price_per_token_sol=listing.price_per_token_sol,
        total_tokens=listing.total_tokens,
        available_tokens=listing.available_tokens,
        settlement_currency=listing.settlement_currency,
        network=listing.network,
        treasury_wallet_address=listing.treasury_wallet_address,
        mint_address=listing.mint_address,
        external_metadata=listing.external_metadata,
        status=listing.status,
        created_at=listing.created_at,
        updated_at=listing.updated_at,
        sold_tokens=sold_tokens,
        purchase_count=int(metrics.get("purchase_count", 0)),
        volume_sol=float(metrics.get("volume_sol", 0.0)),
    )


def _build_purchase_response(purchase) -> MarketplacePurchaseRead:
    listing = purchase.listing
    if not listing:
        raise HTTPException(status_code=500, detail="Purchase listing relation is missing")

    listing_payload = _build_listing_response(listing)
    return MarketplacePurchaseRead(
        id=purchase.id,
        user_id=purchase.user_id,
        listing_id=purchase.listing_id,
        quantity=purchase.quantity,
        price_per_token_sol=purchase.price_per_token_sol,
        quoted_total_sol=purchase.quoted_total_sol,
        total_sol=purchase.total_sol,
        expected_lamports=purchase.expected_lamports,
        payment_wallet_address=purchase.payment_wallet_address,
        treasury_wallet_address=purchase.treasury_wallet_address,
        reference_code=purchase.reference_code,
        tx_signature=purchase.tx_signature,
        status=purchase.status,
        failure_reason=purchase.failure_reason,
        payment_metadata=purchase.payment_metadata,
        expires_at=purchase.expires_at,
        confirmed_at=purchase.confirmed_at,
        created_at=purchase.created_at,
        updated_at=purchase.updated_at,
        listing=listing_payload,
    )


@router.get("/listings", response_model=MarketplaceListingListResponse)
async def list_marketplace_listings(db: AsyncSession = Depends(get_db)):
    listings, metrics = await MarketplaceService.list_public_listings(db)

    active_items = [listing for listing in listings if listing.status == "active"]
    floor_price = min((listing.price_per_token_sol for listing in active_items), default=None)
    total_available_tokens = sum(listing.available_tokens for listing in active_items)
    total_volume_sol = sum(float(value.get("volume_sol", 0.0)) for value in metrics.values())

    return MarketplaceListingListResponse(
        total=len(listings),
        stats=MarketplaceStatsResponse(
            active_listings=len(active_items),
            total_available_tokens=total_available_tokens,
            total_volume_sol=round(total_volume_sol, 9),
            floor_price_sol=floor_price,
        ),
        items=[_build_listing_response(listing, metrics.get(listing.id)) for listing in listings],
    )


@router.get("/listings/{listing_id}", response_model=MarketplaceListingRead)
async def get_marketplace_listing(
    listing_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    listing = await MarketplaceService.get_listing(db, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    metrics = await MarketplaceService._listing_purchase_metrics(db)
    return _build_listing_response(listing, metrics.get(listing.id))


@router.post("/listings", response_model=MarketplaceListingRead, status_code=201)
async def create_marketplace_listing(
    payload: CreateMarketplaceListingRequest,
    current_user: User = Depends(require_roles("issuer", "admin", "compliance_officer")),
    db: AsyncSession = Depends(get_db),
):
    listing = await MarketplaceService.create_listing(db, payload, current_user)
    await AuditService.write(
        db,
        action="marketplace.listing_created",
        entity_type="marketplace_listing",
        entity_id=str(listing.id),
        actor_id=current_user.id,
        payload={"patent_number": listing.patent_number, "token_symbol": listing.token_symbol},
    )
    return _build_listing_response(listing)


@router.get("/history", response_model=MarketplacePurchaseHistoryResponse)
async def get_marketplace_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    purchases = await MarketplaceService.list_user_purchases(db, current_user.id)
    return MarketplacePurchaseHistoryResponse(
        total=len(purchases),
        items=[_build_purchase_response(purchase) for purchase in purchases],
    )


@router.get("/holdings", response_model=MarketplaceHoldingsResponse)
async def get_marketplace_holdings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    holdings = await MarketplaceService.list_user_holdings(db, current_user.id)
    summary = MarketplacePortfolioSummary(
        total_positions=len(holdings),
        total_tokens=sum(item["quantity"] for item in holdings),
        invested_sol=round(sum(item["invested_sol"] for item in holdings), 9),
        current_value_sol=round(sum(item["current_value_sol"] for item in holdings), 9),
    )
    return MarketplaceHoldingsResponse(summary=summary, items=holdings)


@router.post("/purchases", response_model=MarketplacePurchaseIntentResponse, status_code=201)
async def create_marketplace_purchase(
    payload: CreateMarketplacePurchaseRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    purchase = await MarketplaceService.create_purchase_intent(
        db=db,
        user=current_user,
        listing_id=payload.listing_id,
        quantity=payload.quantity,
    )
    purchase = await MarketplaceService.get_purchase_for_user(db, purchase.id, current_user)
    if not purchase:
        raise HTTPException(status_code=500, detail="Failed to load purchase after creation")

    await AuditService.write(
        db,
        action="marketplace.purchase_intent_created",
        entity_type="marketplace_purchase",
        entity_id=str(purchase.id),
        actor_id=current_user.id,
        payload={
            "listing_id": str(purchase.listing_id),
            "quantity": purchase.quantity,
            "total_sol": purchase.total_sol,
        },
    )

    return MarketplacePurchaseIntentResponse(
        purchase=_build_purchase_response(purchase),
        transaction={
            "network": purchase.listing.network,
            "rpc_url": settings.SOLANA_RPC_URL,
            "treasury_wallet_address": purchase.treasury_wallet_address,
            "purchaser_wallet_address": purchase.payment_wallet_address,
            "amount_sol": purchase.total_sol,
            "amount_lamports": purchase.expected_lamports,
            "expires_at": purchase.expires_at,
        },
    )


@router.post("/purchases/{purchase_id}/confirm", response_model=MarketplacePurchaseRead)
async def confirm_marketplace_purchase(
    purchase_id: uuid.UUID,
    payload: ConfirmMarketplacePurchaseRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    purchase = await MarketplaceService.get_purchase_for_user(db, purchase_id, current_user)
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")
    if purchase.status == MarketplacePurchaseStatus.confirmed.value:
        return _build_purchase_response(purchase)

    confirmed = await MarketplaceService.confirm_purchase(db, purchase, payload.tx_signature)
    confirmed = await MarketplaceService.get_purchase_for_user(db, confirmed.id, current_user)
    if not confirmed:
        raise HTTPException(status_code=500, detail="Failed to reload confirmed purchase")

    await AuditService.write(
        db,
        action="marketplace.purchase_confirmed",
        entity_type="marketplace_purchase",
        entity_id=str(confirmed.id),
        actor_id=current_user.id,
        payload={
            "listing_id": str(confirmed.listing_id),
            "quantity": confirmed.quantity,
            "tx_signature": confirmed.tx_signature,
            "total_sol": confirmed.total_sol,
        },
    )
    return _build_purchase_response(confirmed)
