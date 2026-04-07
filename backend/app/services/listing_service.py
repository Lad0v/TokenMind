from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.blockchain.client import SolanaBlockchainClient
from app.core.config import settings
from app.models.blockchain import (
    AssetListing,
    BlockchainOperation,
    BlockchainTransaction,
    BlockchainTxStatus,
    ListingStatus,
    TokenizedAsset,
    TokenizedAssetStatus,
)
from app.models.user import User
from app.schemas.blockchain import (
    ListingActionPrepareRequest,
    ListingPrepareRequest,
    TransactionSubmitRequest,
)
from app.services.audit_service import AuditService
from app.services.blockchain_access_service import BlockchainAccessService
from app.services.blockchain_sync_service import BlockchainSyncService
from app.services.tokenization_service import TokenizationService


class ListingService:
    @staticmethod
    async def get_listing_public(
        db: AsyncSession,
        listing_id: uuid.UUID,
    ) -> AssetListing:
        stmt = (
            select(AssetListing)
            .where(AssetListing.id == listing_id)
            .options(
                selectinload(AssetListing.tokenized_asset).selectinload(TokenizedAsset.ip_claim),
            )
        )
        result = await db.execute(stmt)
        listing = result.scalar_one_or_none()
        if not listing:
            raise HTTPException(status_code=404, detail="Listing not found")
        return listing

    @staticmethod
    async def list_public_marketplace(
        db: AsyncSession,
        search: str | None = None,
    ) -> list[AssetListing]:
        stmt = (
            select(AssetListing)
            .where(AssetListing.status == ListingStatus.active.value)
            .options(
                selectinload(AssetListing.tokenized_asset).selectinload(TokenizedAsset.ip_claim),
                selectinload(AssetListing.tokenized_asset).selectinload(TokenizedAsset.issuer),
            )
            .order_by(AssetListing.created_at.desc())
        )
        result = await db.execute(stmt)
        items = list(result.scalars().unique().all())
        if not search:
            return items

        term = search.lower().strip()
        filtered: list[AssetListing] = []
        for listing in items:
            claim = listing.tokenized_asset.ip_claim
            haystacks = [
                claim.patent_number if claim else "",
                claim.patent_title if claim else "",
                claim.claimed_owner_name if claim else "",
            ]
            if any(term in (value or "").lower() for value in haystacks):
                filtered.append(listing)
        return filtered

    @classmethod
    async def prepare_listing(
        cls,
        db: AsyncSession,
        current_user: User,
        tokenization_id: uuid.UUID,
        payload: ListingPrepareRequest,
    ) -> tuple[TokenizedAsset, AssetListing, BlockchainTransaction]:
        asset = await TokenizationService.get_asset_for_user(db, current_user, tokenization_id)
        wallet = await BlockchainAccessService.get_primary_solana_wallet(db, current_user.id)
        if not wallet:
            raise HTTPException(status_code=400, detail="A primary Solana wallet is required")

        if asset.status not in {
            TokenizedAssetStatus.fraction_model_locked.value,
            TokenizedAssetStatus.listed.value,
            TokenizedAssetStatus.paused.value,
        }:
            raise HTTPException(
                status_code=400,
                detail="Listing can be prepared only after the fraction model is locked",
            )

        if asset.listing and asset.listing.listing_address:
            raise HTTPException(
                status_code=409,
                detail="This tokenized asset already has an on-chain listing mirror",
            )

        tx_stmt = select(BlockchainTransaction).where(
            BlockchainTransaction.client_request_id == payload.client_request_id
        )
        tx_result = await db.execute(tx_stmt)
        existing_tx = tx_result.scalar_one_or_none()
        if existing_tx:
            if not asset.listing:
                raise HTTPException(status_code=409, detail="Listing prepare request is detached from asset state")
            return asset, asset.listing, existing_tx

        listing = asset.listing
        if listing is None:
            listing = AssetListing(
                tokenized_asset_id=asset.id,
                platform_treasury_address=settings.SOLANA_PLATFORM_TREASURY,
                price_per_share_lamports=payload.price_per_share_lamports,
                start_ts=payload.start_ts,
                end_ts=payload.end_ts,
                platform_fee_bps=payload.platform_fee_bps,
                status=ListingStatus.draft.value,
            )
            db.add(listing)
        else:
            listing.platform_treasury_address = settings.SOLANA_PLATFORM_TREASURY
            listing.price_per_share_lamports = payload.price_per_share_lamports
            listing.start_ts = payload.start_ts
            listing.end_ts = payload.end_ts
            listing.platform_fee_bps = payload.platform_fee_bps
            listing.status = ListingStatus.draft.value
            listing.last_error = None

        transaction = BlockchainTransaction(
            tokenized_asset_id=asset.id,
            listing=listing,
            user_id=current_user.id,
            operation=BlockchainOperation.create_listing.value,
            status=BlockchainTxStatus.prepared.value,
            wallet_address=wallet.wallet_address,
            client_request_id=payload.client_request_id,
        )
        db.add(transaction)
        await db.flush()
        await db.refresh(listing)
        await db.refresh(transaction)

        await AuditService.write(
            db,
            action="blockchain.listing_prepared",
            entity_type="asset_listing",
            entity_id=str(listing.id),
            actor_id=current_user.id,
            payload={
                "tokenized_asset_id": str(asset.id),
                "price_per_share_lamports": listing.price_per_share_lamports,
                "platform_fee_bps": listing.platform_fee_bps,
            },
        )
        return asset, listing, transaction

    @classmethod
    async def submit_listing(
        cls,
        db: AsyncSession,
        current_user: User,
        tokenization_id: uuid.UUID,
        payload: TransactionSubmitRequest,
        client: SolanaBlockchainClient,
    ) -> tuple[TokenizedAsset, AssetListing, BlockchainTransaction]:
        asset = await TokenizationService.get_asset_for_user(db, current_user, tokenization_id)
        wallet = await BlockchainAccessService.get_primary_solana_wallet(db, current_user.id)
        if not wallet or wallet.wallet_address != payload.wallet_address:
            raise HTTPException(status_code=400, detail="Submitting wallet does not match the issuer primary wallet")
        if not asset.listing:
            raise HTTPException(status_code=400, detail="Prepare listing before submitting it on-chain")

        tx_stmt = (
            select(BlockchainTransaction)
            .where(
                BlockchainTransaction.listing_id == asset.listing.id,
                BlockchainTransaction.operation == BlockchainOperation.create_listing.value,
            )
            .order_by(BlockchainTransaction.created_at.desc())
        )
        tx_result = await db.execute(tx_stmt)
        transaction = tx_result.scalars().first()
        if not transaction:
            raise HTTPException(status_code=400, detail="Prepare listing before submitting it on-chain")

        confirmed_tx = await BlockchainSyncService.confirm_listing_create(
            db=db,
            asset=asset,
            listing=asset.listing,
            transaction=transaction,
            submission=payload,
            client=client,
        )
        await AuditService.write(
            db,
            action="blockchain.create_listing.confirmed",
            entity_type="asset_listing",
            entity_id=str(asset.listing.id),
            actor_id=current_user.id,
            payload={"tx_signature": payload.tx_signature},
        )
        return asset, asset.listing, confirmed_tx

    @classmethod
    async def prepare_listing_action(
        cls,
        db: AsyncSession,
        current_user: User,
        listing_id: uuid.UUID,
        operation: BlockchainOperation,
        payload: ListingActionPrepareRequest,
    ) -> tuple[AssetListing, BlockchainTransaction]:
        if operation not in {BlockchainOperation.pause_listing, BlockchainOperation.close_listing}:
            raise HTTPException(status_code=400, detail=f"{operation.value} is not a supported listing action")

        listing = await BlockchainAccessService.ensure_listing_owner_access(db, current_user, listing_id)
        wallet = await BlockchainAccessService.get_primary_solana_wallet(db, current_user.id)
        if not wallet:
            raise HTTPException(status_code=400, detail="A primary Solana wallet is required")

        if operation == BlockchainOperation.pause_listing and listing.status != ListingStatus.active.value:
            raise HTTPException(status_code=400, detail="Only active listings can be paused")

        tx_stmt = select(BlockchainTransaction).where(
            BlockchainTransaction.client_request_id == payload.client_request_id
        )
        tx_result = await db.execute(tx_stmt)
        existing_tx = tx_result.scalar_one_or_none()
        if existing_tx:
            return listing, existing_tx

        transaction = BlockchainTransaction(
            tokenized_asset_id=listing.tokenized_asset_id,
            listing_id=listing.id,
            user_id=current_user.id,
            operation=operation.value,
            status=BlockchainTxStatus.prepared.value,
            wallet_address=wallet.wallet_address,
            client_request_id=payload.client_request_id,
        )
        db.add(transaction)
        await db.flush()
        await db.refresh(transaction)
        await AuditService.write(
            db,
            action=f"blockchain.{operation.value}.prepared",
            entity_type="asset_listing",
            entity_id=str(listing.id),
            actor_id=current_user.id,
        )
        return listing, transaction

    @classmethod
    async def submit_listing_action(
        cls,
        db: AsyncSession,
        current_user: User,
        listing_id: uuid.UUID,
        operation: BlockchainOperation,
        payload: TransactionSubmitRequest,
        client: SolanaBlockchainClient,
    ) -> tuple[AssetListing, BlockchainTransaction]:
        listing = await BlockchainAccessService.ensure_listing_owner_access(db, current_user, listing_id)
        wallet = await BlockchainAccessService.get_primary_solana_wallet(db, current_user.id)
        if not wallet or wallet.wallet_address != payload.wallet_address:
            raise HTTPException(status_code=400, detail="Submitting wallet does not match the issuer primary wallet")

        tx_stmt = (
            select(BlockchainTransaction)
            .where(
                BlockchainTransaction.listing_id == listing.id,
                BlockchainTransaction.operation == operation.value,
            )
            .order_by(BlockchainTransaction.created_at.desc())
        )
        tx_result = await db.execute(tx_stmt)
        transaction = tx_result.scalars().first()
        if not transaction:
            raise HTTPException(status_code=400, detail="Prepare the listing action before submitting it")

        confirmed_tx = await BlockchainSyncService.confirm_listing_action(
            db=db,
            asset=listing.tokenized_asset,
            listing=listing,
            transaction=transaction,
            operation=operation,
            submission=payload,
            client=client,
        )
        await AuditService.write(
            db,
            action=f"blockchain.{operation.value}.confirmed",
            entity_type="asset_listing",
            entity_id=str(listing.id),
            actor_id=current_user.id,
            payload={"tx_signature": payload.tx_signature},
        )
        return listing, confirmed_tx
