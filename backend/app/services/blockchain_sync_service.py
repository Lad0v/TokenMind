from __future__ import annotations

from dataclasses import asdict
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.blockchain.client import BlockchainClientError, SolanaBlockchainClient
from app.blockchain.coding import serialize_snapshot
from app.models.blockchain import (
    AssetListing,
    BlockchainOperation,
    BlockchainSyncStatus,
    BlockchainTransaction,
    BlockchainTxStatus,
    ListingStatus,
    TokenizedAsset,
    TokenizedAssetStatus,
)
from app.schemas.blockchain import TransactionSubmitRequest


_DEFAULT_PUBKEY = "11111111111111111111111111111111"


class BlockchainSyncService:
    @staticmethod
    def _utcnow() -> datetime:
        return datetime.now(timezone.utc)

    @staticmethod
    def _normalize_pubkey(address: str | None) -> str | None:
        if not address or address == _DEFAULT_PUBKEY:
            return None
        return address

    @classmethod
    async def _require_signature_success(
        cls,
        client: SolanaBlockchainClient,
        tx_signature: str,
    ) -> dict:
        status = await client.get_signature_status(tx_signature)
        if status is None:
            raise HTTPException(
                status_code=502,
                detail="Transaction was not found on the configured Solana RPC yet",
            )
        if status.err:
            raise HTTPException(
                status_code=400,
                detail=f"Solana transaction failed: {status.err}",
            )
        return serialize_snapshot(asdict(status))

    @classmethod
    async def _mark_failure(
        cls,
        db: AsyncSession,
        asset: TokenizedAsset | None,
        listing: AssetListing | None,
        transaction: BlockchainTransaction,
        message: str,
    ) -> None:
        transaction.status = BlockchainTxStatus.failed.value
        transaction.error_message = message
        if asset is not None:
            asset.sync_status = BlockchainSyncStatus.failed.value
            asset.last_error = message
        if listing is not None:
            listing.sync_status = BlockchainSyncStatus.failed.value
            listing.last_error = message
        await db.flush()

    @classmethod
    async def _get_existing_transaction(
        cls,
        db: AsyncSession,
        tx_signature: str,
    ) -> BlockchainTransaction | None:
        stmt = select(BlockchainTransaction).where(BlockchainTransaction.tx_signature == tx_signature)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @classmethod
    async def confirm_tokenization_step(
        cls,
        db: AsyncSession,
        asset: TokenizedAsset,
        operation: BlockchainOperation,
        submission: TransactionSubmitRequest,
        client: SolanaBlockchainClient,
    ) -> BlockchainTransaction:
        now = cls._utcnow()
        transaction = await cls._get_existing_transaction(db, submission.tx_signature)
        if transaction is None:
            transaction = BlockchainTransaction(
                tokenized_asset_id=asset.id,
                user_id=asset.issuer_user_id,
                operation=operation.value,
                status=BlockchainTxStatus.submitted.value,
                wallet_address=submission.wallet_address,
                tx_signature=submission.tx_signature,
                submitted_at=now,
            )
            db.add(transaction)
        else:
            transaction.operation = operation.value
            transaction.wallet_address = submission.wallet_address
            transaction.status = BlockchainTxStatus.submitted.value
            transaction.submitted_at = transaction.submitted_at or now

        asset.sync_status = BlockchainSyncStatus.pending.value
        asset.last_error = None

        try:
            signature_payload = await cls._require_signature_success(client, submission.tx_signature)

            if operation == BlockchainOperation.initialize_asset:
                address = submission.asset_config_address or asset.asset_config_address
                if not address:
                    raise HTTPException(status_code=400, detail="asset_config_address is required")
                onchain_asset = await client.get_asset_config(address)
                if onchain_asset.asset_id != asset.asset_id:
                    raise HTTPException(status_code=400, detail="Asset ID mismatch for initialize_asset")
                if onchain_asset.issuer != asset.issuer_wallet_address:
                    raise HTTPException(status_code=400, detail="Issuer wallet mismatch for initialize_asset")
                asset.asset_config_address = address
                asset.sale_supply = onchain_asset.sale_supply
                asset.status = TokenizedAssetStatus.asset_initialized.value
                snapshot = {"asset_config": serialize_snapshot(asdict(onchain_asset))}

            elif operation == BlockchainOperation.mint_asset_tokens:
                address = asset.asset_config_address or submission.asset_config_address
                if not address:
                    raise HTTPException(status_code=400, detail="asset_config_address is required")
                onchain_asset = await client.get_asset_config(address)
                if not onchain_asset.is_minted:
                    raise HTTPException(status_code=400, detail="Asset is not marked as minted on-chain")
                asset.asset_config_address = address
                asset.mint_address = cls._normalize_pubkey(onchain_asset.mint)
                asset.status = TokenizedAssetStatus.minted.value
                snapshot = {"asset_config": serialize_snapshot(asdict(onchain_asset))}

            elif operation == BlockchainOperation.revoke_mint_authority:
                address = asset.asset_config_address or submission.asset_config_address
                if not address:
                    raise HTTPException(status_code=400, detail="asset_config_address is required")
                onchain_asset = await client.get_asset_config(address)
                asset.asset_config_address = address
                asset.mint_address = cls._normalize_pubkey(onchain_asset.mint)
                asset.mint_authority_revoked = True
                asset.status = TokenizedAssetStatus.mint_authority_revoked.value
                snapshot = {"asset_config": serialize_snapshot(asdict(onchain_asset))}

            elif operation in {
                BlockchainOperation.configure_fractionalization,
                BlockchainOperation.deposit_sale_supply,
                BlockchainOperation.lock_fraction_model,
            }:
                fraction_address = submission.fraction_config_address or asset.fraction_config_address
                if not fraction_address:
                    raise HTTPException(status_code=400, detail="fraction_config_address is required")
                onchain_fraction = await client.get_fraction_config(fraction_address)
                if asset.asset_config_address and onchain_fraction.asset != asset.asset_config_address:
                    raise HTTPException(status_code=400, detail="Fraction config is linked to a different asset")
                if onchain_fraction.issuer != asset.issuer_wallet_address:
                    raise HTTPException(status_code=400, detail="Issuer wallet mismatch for fraction config")

                asset.fraction_config_address = fraction_address
                asset.mint_address = cls._normalize_pubkey(onchain_fraction.mint)
                asset.sale_supply = onchain_fraction.sale_supply
                asset.issuer_reserve = onchain_fraction.issuer_reserve
                asset.platform_reserve = onchain_fraction.platform_reserve

                if operation == BlockchainOperation.configure_fractionalization:
                    asset.status = TokenizedAssetStatus.fraction_configured.value
                elif operation == BlockchainOperation.deposit_sale_supply:
                    if not onchain_fraction.sale_deposited:
                        raise HTTPException(status_code=400, detail="Sale supply has not been deposited on-chain")
                    asset.status = TokenizedAssetStatus.sale_supply_deposited.value
                else:
                    if not onchain_fraction.is_locked:
                        raise HTTPException(status_code=400, detail="Fraction model is not locked on-chain")
                    asset.status = TokenizedAssetStatus.fraction_model_locked.value

                snapshot = {"fraction_config": serialize_snapshot(asdict(onchain_fraction))}
            else:
                raise HTTPException(status_code=400, detail=f"{operation.value} is not a tokenization step")

            asset.last_completed_operation = operation.value
            asset.sync_status = BlockchainSyncStatus.synced.value
            asset.last_synced_at = now
            asset.chain_snapshot = {
                "signature": signature_payload,
                **snapshot,
            }
            transaction.status = BlockchainTxStatus.confirmed.value
            transaction.confirmed_at = now
            transaction.error_message = None
            transaction.response_payload = asset.chain_snapshot
            await db.flush()
            await db.refresh(transaction)
            return transaction

        except (BlockchainClientError, HTTPException) as exc:
            message = exc.detail if isinstance(exc, HTTPException) else str(exc)
            asset.status = TokenizedAssetStatus.failed.value
            await cls._mark_failure(db, asset, None, transaction, message)
            if isinstance(exc, HTTPException):
                raise
            raise HTTPException(status_code=502, detail=message) from exc

    @classmethod
    async def confirm_listing_create(
        cls,
        db: AsyncSession,
        asset: TokenizedAsset,
        listing: AssetListing,
        transaction: BlockchainTransaction,
        submission: TransactionSubmitRequest,
        client: SolanaBlockchainClient,
    ) -> BlockchainTransaction:
        now = cls._utcnow()
        transaction.tx_signature = submission.tx_signature
        transaction.wallet_address = submission.wallet_address
        transaction.status = BlockchainTxStatus.submitted.value
        transaction.submitted_at = transaction.submitted_at or now

        try:
            signature_payload = await cls._require_signature_success(client, submission.tx_signature)
            listing_address = submission.listing_address or listing.listing_address
            if not listing_address:
                raise HTTPException(status_code=400, detail="listing_address is required")
            onchain_listing = await client.get_listing_state(listing_address)

            if asset.asset_config_address and onchain_listing.asset != asset.asset_config_address:
                raise HTTPException(status_code=400, detail="Listing is linked to a different asset config")
            if asset.fraction_config_address and onchain_listing.fraction_config != asset.fraction_config_address:
                raise HTTPException(status_code=400, detail="Listing is linked to a different fraction config")
            if onchain_listing.issuer != asset.issuer_wallet_address:
                raise HTTPException(status_code=400, detail="Issuer wallet mismatch for listing")

            listing.listing_address = listing_address
            listing.sale_vault_address = cls._normalize_pubkey(onchain_listing.sale_vault)
            listing.price_per_share_lamports = onchain_listing.price_per_share_lamports
            listing.remaining_supply = onchain_listing.remaining_supply
            listing.start_ts = onchain_listing.start_ts
            listing.end_ts = onchain_listing.end_ts
            listing.platform_fee_bps = onchain_listing.platform_fee_bps
            listing.trade_count = onchain_listing.trade_count
            listing.status = ListingStatus.active.value
            listing.sync_status = BlockchainSyncStatus.synced.value
            listing.last_synced_at = now
            listing.last_error = None

            asset.status = TokenizedAssetStatus.listed.value
            asset.last_completed_operation = BlockchainOperation.create_listing.value
            asset.sync_status = BlockchainSyncStatus.synced.value
            asset.last_synced_at = now
            asset.last_error = None
            asset.chain_snapshot = {
                "signature": signature_payload,
                "listing": serialize_snapshot(asdict(onchain_listing)),
            }

            transaction.status = BlockchainTxStatus.confirmed.value
            transaction.confirmed_at = now
            transaction.error_message = None
            transaction.response_payload = asset.chain_snapshot
            await db.flush()
            await db.refresh(transaction)
            return transaction

        except (BlockchainClientError, HTTPException) as exc:
            message = exc.detail if isinstance(exc, HTTPException) else str(exc)
            asset.status = TokenizedAssetStatus.failed.value
            listing.status = ListingStatus.failed.value
            await cls._mark_failure(db, asset, listing, transaction, message)
            if isinstance(exc, HTTPException):
                raise
            raise HTTPException(status_code=502, detail=message) from exc

    @classmethod
    async def confirm_listing_action(
        cls,
        db: AsyncSession,
        asset: TokenizedAsset,
        listing: AssetListing,
        transaction: BlockchainTransaction,
        operation: BlockchainOperation,
        submission: TransactionSubmitRequest,
        client: SolanaBlockchainClient,
    ) -> BlockchainTransaction:
        now = cls._utcnow()
        transaction.tx_signature = submission.tx_signature
        transaction.wallet_address = submission.wallet_address
        transaction.status = BlockchainTxStatus.submitted.value
        transaction.submitted_at = transaction.submitted_at or now

        try:
            signature_payload = await cls._require_signature_success(client, submission.tx_signature)
            listing_address = submission.listing_address or listing.listing_address
            if not listing_address:
                raise HTTPException(status_code=400, detail="listing_address is required")
            onchain_listing = await client.get_listing_state(listing_address)

            listing.listing_address = listing_address
            listing.sale_vault_address = cls._normalize_pubkey(onchain_listing.sale_vault)
            listing.remaining_supply = onchain_listing.remaining_supply
            listing.trade_count = onchain_listing.trade_count
            listing.sync_status = BlockchainSyncStatus.synced.value
            listing.last_synced_at = now
            listing.last_error = None

            if operation == BlockchainOperation.pause_listing:
                listing.status = ListingStatus.paused.value
                asset.status = TokenizedAssetStatus.paused.value
            elif operation == BlockchainOperation.close_listing:
                listing.status = ListingStatus.closed.value
                asset.status = TokenizedAssetStatus.closed.value
            else:
                raise HTTPException(status_code=400, detail=f"{operation.value} is not a listing action")

            asset.last_completed_operation = operation.value
            asset.sync_status = BlockchainSyncStatus.synced.value
            asset.last_synced_at = now
            asset.last_error = None
            asset.chain_snapshot = {
                "signature": signature_payload,
                "listing": serialize_snapshot(asdict(onchain_listing)),
            }

            transaction.status = BlockchainTxStatus.confirmed.value
            transaction.confirmed_at = now
            transaction.error_message = None
            transaction.response_payload = asset.chain_snapshot
            await db.flush()
            await db.refresh(transaction)
            return transaction

        except (BlockchainClientError, HTTPException) as exc:
            message = exc.detail if isinstance(exc, HTTPException) else str(exc)
            await cls._mark_failure(db, asset, listing, transaction, message)
            if isinstance(exc, HTTPException):
                raise
            raise HTTPException(status_code=502, detail=message) from exc

    @classmethod
    async def confirm_purchase(
        cls,
        db: AsyncSession,
        asset: TokenizedAsset,
        listing: AssetListing,
        transaction: BlockchainTransaction,
        submission: TransactionSubmitRequest,
        client: SolanaBlockchainClient,
    ) -> BlockchainTransaction:
        now = cls._utcnow()
        transaction.tx_signature = submission.tx_signature
        transaction.wallet_address = submission.wallet_address
        transaction.trade_receipt_address = submission.trade_receipt_address
        transaction.status = BlockchainTxStatus.submitted.value
        transaction.submitted_at = transaction.submitted_at or now

        try:
            signature_payload = await cls._require_signature_success(client, submission.tx_signature)
            listing_address = listing.listing_address or submission.listing_address
            if not listing_address:
                raise HTTPException(status_code=400, detail="Listing is missing an on-chain listing address")
            if not submission.trade_receipt_address:
                raise HTTPException(status_code=400, detail="trade_receipt_address is required for purchases")

            onchain_listing = await client.get_listing_state(listing_address)
            trade_receipt = await client.get_trade_receipt(submission.trade_receipt_address)

            if trade_receipt.listing != listing_address:
                raise HTTPException(status_code=400, detail="Trade receipt does not belong to this listing")
            if trade_receipt.buyer != submission.wallet_address:
                raise HTTPException(status_code=400, detail="Trade receipt buyer does not match the submitting wallet")
            if asset.mint_address and trade_receipt.mint != asset.mint_address:
                raise HTTPException(status_code=400, detail="Trade receipt mint does not match tokenized asset mint")

            listing.remaining_supply = onchain_listing.remaining_supply
            listing.trade_count = onchain_listing.trade_count
            listing.status = (
                ListingStatus.sold_out.value
                if onchain_listing.remaining_supply == 0
                else ListingStatus.active.value
            )
            listing.sync_status = BlockchainSyncStatus.synced.value
            listing.last_synced_at = now
            listing.last_error = None

            asset.status = (
                TokenizedAssetStatus.closed.value
                if listing.status == ListingStatus.sold_out.value
                else TokenizedAssetStatus.listed.value
            )
            asset.sync_status = BlockchainSyncStatus.synced.value
            asset.last_synced_at = now
            asset.last_error = None
            asset.chain_snapshot = {
                "signature": signature_payload,
                "listing": serialize_snapshot(asdict(onchain_listing)),
                "trade_receipt": serialize_snapshot(asdict(trade_receipt)),
            }

            transaction.quantity = trade_receipt.qty
            transaction.trade_index = trade_receipt.trade_index
            transaction.gross_amount_lamports = trade_receipt.gross_amount_lamports
            transaction.fee_amount_lamports = trade_receipt.fee_amount_lamports
            transaction.net_amount_lamports = trade_receipt.net_amount_lamports
            transaction.status = BlockchainTxStatus.confirmed.value
            transaction.confirmed_at = now
            transaction.error_message = None
            transaction.response_payload = asset.chain_snapshot
            await db.flush()
            await db.refresh(transaction)
            return transaction

        except (BlockchainClientError, HTTPException) as exc:
            message = exc.detail if isinstance(exc, HTTPException) else str(exc)
            await cls._mark_failure(db, asset, listing, transaction, message)
            if isinstance(exc, HTTPException):
                raise
            raise HTTPException(status_code=502, detail=message) from exc
