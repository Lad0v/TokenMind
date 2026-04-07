from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.blockchain.client import SolanaBlockchainClient
from app.models.blockchain import (
    AssetListing,
    BlockchainOperation,
    BlockchainTransaction,
    BlockchainTxStatus,
    ListingStatus,
    TokenizedAsset,
)
from app.models.user import User
from app.schemas.blockchain import PurchasePrepareRequest, TransactionSubmitRequest
from app.services.audit_service import AuditService
from app.services.blockchain_access_service import BlockchainAccessService
from app.services.blockchain_sync_service import BlockchainSyncService
from app.services.listing_service import ListingService


class PurchaseService:
    @staticmethod
    def _utcnow() -> datetime:
        return datetime.now(timezone.utc)

    @classmethod
    async def prepare_purchase(
        cls,
        db: AsyncSession,
        current_user: User,
        listing_id: uuid.UUID,
        payload: PurchasePrepareRequest,
    ) -> tuple[AssetListing, BlockchainTransaction]:
        wallet = await BlockchainAccessService.ensure_investor_purchase_allowed(db, current_user)
        listing = await ListingService.get_listing_public(db, listing_id)

        now = cls._utcnow()
        if listing.status != ListingStatus.active.value:
            raise HTTPException(status_code=400, detail="Only active listings can be purchased")
        if now < listing.start_ts or now > listing.end_ts:
            raise HTTPException(status_code=400, detail="Listing is outside its primary sale window")
        if listing.remaining_supply is not None and payload.qty > listing.remaining_supply:
            raise HTTPException(status_code=400, detail="Requested quantity exceeds remaining listing supply")

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
            operation=BlockchainOperation.buy_shares.value,
            status=BlockchainTxStatus.prepared.value,
            wallet_address=wallet.wallet_address,
            client_request_id=payload.client_request_id,
            quantity=payload.qty,
        )
        db.add(transaction)
        await db.flush()
        await db.refresh(transaction)

        await AuditService.write(
            db,
            action="blockchain.buy_shares.prepared",
            entity_type="asset_listing",
            entity_id=str(listing.id),
            actor_id=current_user.id,
            payload={"qty": payload.qty},
        )
        return listing, transaction

    @classmethod
    async def submit_purchase(
        cls,
        db: AsyncSession,
        current_user: User,
        purchase_id: uuid.UUID,
        payload: TransactionSubmitRequest,
        client: SolanaBlockchainClient,
    ) -> tuple[AssetListing, BlockchainTransaction]:
        wallet = await BlockchainAccessService.ensure_investor_purchase_allowed(db, current_user)
        if wallet.wallet_address != payload.wallet_address:
            raise HTTPException(status_code=400, detail="Submitting wallet does not match the investor primary wallet")

        stmt = (
            select(BlockchainTransaction)
            .where(BlockchainTransaction.id == purchase_id)
            .options(
                selectinload(BlockchainTransaction.listing).selectinload(AssetListing.tokenized_asset),
                selectinload(BlockchainTransaction.tokenized_asset).selectinload(TokenizedAsset.ip_claim),
            )
        )
        result = await db.execute(stmt)
        transaction = result.scalar_one_or_none()
        if not transaction or transaction.user_id != current_user.id:
            raise HTTPException(status_code=404, detail="Purchase intent not found")
        if transaction.operation != BlockchainOperation.buy_shares.value:
            raise HTTPException(status_code=400, detail="Transaction is not a primary purchase intent")
        if not transaction.listing or not transaction.tokenized_asset:
            raise HTTPException(status_code=400, detail="Purchase intent is missing listing metadata")

        confirmed_tx = await BlockchainSyncService.confirm_purchase(
            db=db,
            asset=transaction.tokenized_asset,
            listing=transaction.listing,
            transaction=transaction,
            submission=payload,
            client=client,
        )
        await AuditService.write(
            db,
            action="blockchain.buy_shares.confirmed",
            entity_type="asset_listing",
            entity_id=str(transaction.listing.id),
            actor_id=current_user.id,
            payload={"tx_signature": payload.tx_signature, "qty": confirmed_tx.quantity},
        )
        return transaction.listing, confirmed_tx

    @classmethod
    async def get_holdings(
        cls,
        db: AsyncSession,
        current_user: User,
    ) -> list[dict]:
        stmt = (
            select(BlockchainTransaction)
            .where(
                BlockchainTransaction.user_id == current_user.id,
                BlockchainTransaction.operation == BlockchainOperation.buy_shares.value,
                BlockchainTransaction.status == BlockchainTxStatus.confirmed.value,
            )
            .options(
                selectinload(BlockchainTransaction.tokenized_asset).selectinload(TokenizedAsset.ip_claim),
                selectinload(BlockchainTransaction.listing),
            )
            .order_by(BlockchainTransaction.created_at.desc())
        )
        result = await db.execute(stmt)
        transactions = list(result.scalars().all())

        holdings: dict[uuid.UUID, dict] = {}
        for transaction in transactions:
            asset = transaction.tokenized_asset
            listing = transaction.listing
            if not asset or not asset.ip_claim:
                continue

            record = holdings.setdefault(
                asset.id,
                {
                    "tokenization_id": asset.id,
                    "asset_name": asset.ip_claim.patent_title or asset.ip_claim.patent_number,
                    "patent_number": asset.ip_claim.patent_number,
                    "quantity": 0,
                    "gross_total": 0,
                    "current_price_lamports": listing.price_per_share_lamports if listing else None,
                    "listing_status": listing.status if listing else None,
                    "mint_address": asset.mint_address,
                },
            )
            record["quantity"] += transaction.quantity or 0
            record["gross_total"] += transaction.gross_amount_lamports or 0
            if listing:
                record["current_price_lamports"] = listing.price_per_share_lamports
                record["listing_status"] = listing.status

        items: list[dict] = []
        for record in holdings.values():
            quantity = record["quantity"]
            average_price = int(record["gross_total"] / quantity) if quantity else 0
            current_price = record["current_price_lamports"]
            items.append(
                {
                    "tokenization_id": record["tokenization_id"],
                    "asset_name": record["asset_name"],
                    "patent_number": record["patent_number"],
                    "quantity": quantity,
                    "average_price_lamports": average_price,
                    "current_price_lamports": current_price,
                    "invested_lamports": record["gross_total"],
                    "current_value_lamports": current_price * quantity if current_price is not None else None,
                    "listing_status": record["listing_status"],
                    "mint_address": record["mint_address"],
                }
            )
        return items

    @classmethod
    async def get_trade_history(
        cls,
        db: AsyncSession,
        current_user: User,
    ) -> list[BlockchainTransaction]:
        stmt = (
            select(BlockchainTransaction)
            .where(
                BlockchainTransaction.user_id == current_user.id,
                BlockchainTransaction.operation == BlockchainOperation.buy_shares.value,
            )
            .options(
                selectinload(BlockchainTransaction.tokenized_asset).selectinload(TokenizedAsset.ip_claim),
            )
            .order_by(BlockchainTransaction.created_at.desc())
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())
