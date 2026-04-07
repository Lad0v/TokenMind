from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ip_claim import IpClaim, IpClaimStatus
from app.models.marketplace import MarketplaceListing, MarketplaceListingStatus
from app.models.user import UserRole, VerificationCase, VerificationStatus
from app.services.user_service import UserService

SELLER_WALLET = "BTUzWTH25WMhdeye5RbwQFtR2VdiMyU2DpJM9pT1Za3c"
BUYER_WALLET = "4XeEJCxc1TLRaFzyfjYjELPdExY1imRAqiZqjuRqz6Kt"


async def _create_approved_claim(db_session: AsyncSession, seller_id):
    claim = IpClaim(
        issuer_user_id=seller_id,
        patent_number="US-MVP-2026-001",
        patent_title="Marketplace MVP Seller Patent",
        claimed_owner_name="Seller Labs",
        description="Approved claim prepared for marketplace listing tests.",
        jurisdiction="US",
        status=IpClaimStatus.approved.value,
        prechecked=True,
    )
    db_session.add(claim)
    await db_session.flush()
    await db_session.refresh(claim)
    return claim


@pytest.mark.asyncio
async def test_create_marketplace_listing_requires_linked_wallet_for_seller(
    client: AsyncClient,
    db_session: AsyncSession,
    make_user,
    auth_headers,
):
    seller = await make_user(role=UserRole.user.value)
    claim = await _create_approved_claim(db_session, seller.id)

    response = await client.post(
        "/api/v1/marketplace/listings",
        headers=auth_headers(seller),
        json={
            "claim_id": str(claim.id),
            "title": "Seller Wallet Required Listing",
            "patent_number": claim.patent_number,
            "issuer_name": "Seller Labs",
            "token_symbol": "SELLR",
            "price_per_token_sol": 0.5,
            "total_tokens": 100,
            "network": "solana-devnet",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Link a primary Solana wallet before creating a marketplace listing"


@pytest.mark.asyncio
async def test_create_marketplace_listing_uses_primary_wallet_for_seller(
    client: AsyncClient,
    db_session: AsyncSession,
    make_user,
    auth_headers,
):
    seller = await make_user(role=UserRole.user.value)
    await UserService.link_wallet(
        db_session,
        user_id=seller.id,
        wallet_address=SELLER_WALLET,
        network="solana-devnet",
        is_primary=True,
    )
    claim = await _create_approved_claim(db_session, seller.id)

    response = await client.post(
        "/api/v1/marketplace/listings",
        headers=auth_headers(seller),
        json={
            "claim_id": str(claim.id),
            "title": "Primary Wallet Seller Listing",
            "patent_number": claim.patent_number,
            "issuer_name": "Seller Labs",
            "token_symbol": "PWSELL",
            "price_per_token_sol": 0.42,
            "total_tokens": 250,
            "network": "solana-devnet",
        },
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["treasury_wallet_address"] == SELLER_WALLET
    assert payload["claim_id"] == str(claim.id)
    assert payload["status"] == MarketplaceListingStatus.active.value


@pytest.mark.asyncio
async def test_create_purchase_intent_uses_exact_sol_amount_and_seller_wallet(
    client: AsyncClient,
    db_session: AsyncSession,
    make_user,
    auth_headers,
):
    seller = await make_user(role=UserRole.user.value)
    await UserService.link_wallet(
        db_session,
        user_id=seller.id,
        wallet_address=SELLER_WALLET,
        network="solana-devnet",
        is_primary=True,
    )
    claim = await _create_approved_claim(db_session, seller.id)

    listing = MarketplaceListing(
        claim_id=claim.id,
        created_by_user_id=seller.id,
        title="Seller Wallet Settlement Listing",
        patent_number=claim.patent_number,
        issuer_name="Seller Labs",
        token_symbol="SETTLE",
        price_per_token_sol=0.42,
        total_tokens=1000,
        available_tokens=1000,
        settlement_currency="SOL",
        network="solana-devnet",
        treasury_wallet_address=SELLER_WALLET,
        status=MarketplaceListingStatus.active.value,
    )
    db_session.add(listing)
    await db_session.flush()
    await db_session.refresh(listing)

    buyer = await make_user(role=UserRole.investor.value)
    await UserService.link_wallet(
        db_session,
        user_id=buyer.id,
        wallet_address=BUYER_WALLET,
        network="solana-devnet",
        is_primary=True,
    )
    db_session.add(
        VerificationCase(
            user_id=buyer.id,
            status=VerificationStatus.approved.value,
        )
    )
    await db_session.flush()

    response = await client.post(
        "/api/v1/marketplace/purchases",
        headers=auth_headers(buyer),
        json={
            "listing_id": str(listing.id),
            "quantity": 2,
        },
    )

    assert response.status_code == 201
    payload = response.json()
    expected_lamports = 840_000_000

    assert payload["transaction"]["treasury_wallet_address"] == SELLER_WALLET
    assert payload["transaction"]["purchaser_wallet_address"] == BUYER_WALLET
    assert payload["transaction"]["amount_lamports"] == expected_lamports
    assert payload["transaction"]["amount_sol"] == pytest.approx(0.84)
    assert payload["purchase"]["quoted_total_sol"] == pytest.approx(0.84)
    assert payload["purchase"]["total_sol"] == pytest.approx(0.84)
    assert payload["purchase"]["expected_lamports"] == expected_lamports
