from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.blockchain.client import AssetConfigAccount, SignatureStatus
from app.blockchain.dependencies import get_blockchain_client
from app.main import app
from app.models.blockchain import (
    AssetListing,
    BlockchainTransaction,
    ListingStatus,
    TokenizedAsset,
    TokenizedAssetStatus,
)
from app.models.ip_claim import IpClaim, IpClaimStatus
from app.models.user import VerificationCase, VerificationStatus, WalletLink


async def _create_wallet(db_session: AsyncSession, user_id, wallet_address: str) -> WalletLink:
    wallet = WalletLink(
        user_id=user_id,
        wallet_address=wallet_address,
        network="solana",
        is_primary=True,
    )
    db_session.add(wallet)
    await db_session.flush()
    return wallet


async def _create_verified_issuer(db_session: AsyncSession, make_user, wallet_address: str):
    issuer = await make_user(role="issuer", status="active", email=f"issuer-{uuid.uuid4().hex[:8]}@example.com")
    await _create_wallet(db_session, issuer.id, wallet_address)
    verification = VerificationCase(
        user_id=issuer.id,
        status=VerificationStatus.approved.value,
        user_address="Issuer Address",
    )
    db_session.add(verification)
    await db_session.flush()
    return issuer


async def _create_approved_claim(db_session: AsyncSession, issuer_id) -> IpClaim:
    claim = IpClaim(
        issuer_user_id=issuer_id,
        patent_number=f"US-{uuid.uuid4().hex[:8]}",
        patent_title="Tokenized Cooling Patent",
        claimed_owner_name="Issuer Labs",
        jurisdiction="US",
        status=IpClaimStatus.approved.value,
    )
    db_session.add(claim)
    await db_session.flush()
    return claim


@pytest.mark.asyncio
async def test_prepare_tokenization_creates_mirror_record(
    client: AsyncClient,
    db_session: AsyncSession,
    make_user,
    auth_headers,
):
    issuer_wallet = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
    issuer = await _create_verified_issuer(db_session, make_user, issuer_wallet)
    claim = await _create_approved_claim(db_session, issuer.id)

    response = await client.post(
        "/api/v1/blockchain/tokenizations/prepare",
        json={
            "claim_id": str(claim.id),
            "total_shares": 1000,
            "sale_supply": 600,
            "issuer_reserve": 300,
            "platform_reserve": 100,
            "revoke_mint_authority": True,
        },
        headers=auth_headers(issuer),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["tokenization"]["status"] == "draft"
    assert body["tokenization"]["claim"]["id"] == str(claim.id)

    tokenized_asset = (
        await db_session.execute(select(TokenizedAsset).where(TokenizedAsset.ip_claim_id == claim.id))
    ).scalar_one()
    assert tokenized_asset.issuer_wallet_address == issuer_wallet
    assert tokenized_asset.status == TokenizedAssetStatus.draft.value


@pytest.mark.asyncio
async def test_submit_initialize_asset_updates_tokenization_state(
    client: AsyncClient,
    db_session: AsyncSession,
    make_user,
    auth_headers,
):
    issuer_wallet = "8xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
    issuer = await _create_verified_issuer(db_session, make_user, issuer_wallet)
    claim = await _create_approved_claim(db_session, issuer.id)

    prepare_response = await client.post(
        "/api/v1/blockchain/tokenizations/prepare",
        json={
            "claim_id": str(claim.id),
            "total_shares": 1000,
            "sale_supply": 500,
            "issuer_reserve": 400,
            "platform_reserve": 100,
            "revoke_mint_authority": False,
        },
        headers=auth_headers(issuer),
    )
    tokenization_id = prepare_response.json()["tokenization"]["id"]
    tokenized_asset = (
        await db_session.execute(select(TokenizedAsset).where(TokenizedAsset.ip_claim_id == claim.id))
    ).scalar_one()

    class FakeClient:
        async def get_signature_status(self, signature: str) -> SignatureStatus:
            return SignatureStatus(
                slot=1,
                confirmations=1,
                confirmation_status="confirmed",
                err=None,
            )

        async def get_asset_config(self, address: str) -> AssetConfigAccount:
            return AssetConfigAccount(
                address=address,
                asset_id=tokenized_asset.asset_id,
                issuer=issuer_wallet,
                mint="11111111111111111111111111111111",
                total_shares=1000,
                minted_supply=0,
                sale_supply=500,
                mint_bump=0,
                asset_bump=255,
                is_minted=False,
            )

    app.dependency_overrides[get_blockchain_client] = lambda: FakeClient()
    try:
        submit_response = await client.post(
            f"/api/v1/blockchain/tokenizations/{tokenization_id}/steps/initialize_asset/submit",
            json={
                "tx_signature": "5" * 88,
                "wallet_address": issuer_wallet,
                "asset_config_address": "9xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
            },
            headers=auth_headers(issuer),
        )
    finally:
        app.dependency_overrides.pop(get_blockchain_client, None)

    assert submit_response.status_code == 200
    body = submit_response.json()
    assert body["tokenization"]["status"] == TokenizedAssetStatus.asset_initialized.value
    assert body["transaction"]["status"] == "confirmed"

    await db_session.refresh(tokenized_asset)
    assert tokenized_asset.status == TokenizedAssetStatus.asset_initialized.value
    assert tokenized_asset.asset_config_address is not None


@pytest.mark.asyncio
async def test_prepare_purchase_uses_listing_mirror(
    client: AsyncClient,
    db_session: AsyncSession,
    make_user,
    auth_headers,
):
    issuer_wallet = "9xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
    investor_wallet = "AxKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"

    issuer = await _create_verified_issuer(db_session, make_user, issuer_wallet)
    investor = await make_user(role="investor", status="active", email=f"investor-{uuid.uuid4().hex[:8]}@example.com")
    await _create_wallet(db_session, investor.id, investor_wallet)
    claim = await _create_approved_claim(db_session, issuer.id)

    tokenized_asset = TokenizedAsset(
        ip_claim_id=claim.id,
        issuer_user_id=issuer.id,
        issuer_wallet_address=issuer_wallet,
        asset_id="tm123456789012345678901234567890",
        asset_config_address="BxKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
        mint_address="CxKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
        fraction_config_address="DxKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
        total_shares=1000,
        sale_supply=600,
        issuer_reserve=300,
        platform_reserve=100,
        revoke_mint_authority_requested=True,
        status=TokenizedAssetStatus.listed.value,
    )
    db_session.add(tokenized_asset)
    await db_session.flush()

    listing = AssetListing(
        tokenized_asset_id=tokenized_asset.id,
        listing_address="ExKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
        sale_vault_address="FxKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
        platform_treasury_address="11111111111111111111111111111111",
        price_per_share_lamports=500_000_000,
        remaining_supply=600,
        start_ts=datetime.now(timezone.utc) - timedelta(hours=1),
        end_ts=datetime.now(timezone.utc) + timedelta(days=1),
        platform_fee_bps=250,
        trade_count=0,
        status=ListingStatus.active.value,
    )
    db_session.add(listing)
    await db_session.flush()

    response = await client.post(
        f"/api/v1/blockchain/listings/{listing.id}/purchase/prepare",
        json={
            "client_request_id": uuid.uuid4().hex,
            "qty": 25,
        },
        headers=auth_headers(investor),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["listing"]["id"] == str(listing.id)
    assert body["transaction"]["status"] == "prepared"
    assert body["transaction"]["quantity"] == 25

    purchase_intent = (
        await db_session.execute(select(BlockchainTransaction).where(BlockchainTransaction.listing_id == listing.id))
    ).scalar_one()
    assert purchase_intent.operation == "buy_shares"
