from __future__ import annotations

import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.blockchain.client import SolanaBlockchainClient
from app.core.config import settings
from app.models.blockchain import BlockchainOperation, TokenizedAsset, TokenizedAssetStatus
from app.models.ip_claim import IpClaim
from app.models.user import User
from app.schemas.blockchain import TokenizationPrepareRequest, TransactionSubmitRequest
from app.services.audit_service import AuditService
from app.services.blockchain_access_service import BlockchainAccessService
from app.services.blockchain_sync_service import BlockchainSyncService


class TokenizationService:
    TOKENIZATION_STEPS = [
        BlockchainOperation.initialize_asset,
        BlockchainOperation.mint_asset_tokens,
        BlockchainOperation.revoke_mint_authority,
        BlockchainOperation.configure_fractionalization,
        BlockchainOperation.deposit_sale_supply,
        BlockchainOperation.lock_fraction_model,
    ]

    @staticmethod
    def build_asset_id(claim_id: uuid.UUID) -> str:
        return f"tm{claim_id.hex[:30]}"

    @staticmethod
    def build_claim_snapshot(claim: IpClaim) -> dict:
        return {
            "claim_id": str(claim.id),
            "patent_number": claim.patent_number,
            "patent_title": claim.patent_title,
            "claimed_owner_name": claim.claimed_owner_name,
            "jurisdiction": claim.jurisdiction,
            "status": claim.status,
        }

    @classmethod
    async def list_issuer_assets(
        cls,
        db: AsyncSession,
        issuer_user_id: uuid.UUID,
    ) -> list[TokenizedAsset]:
        stmt = (
            select(TokenizedAsset)
            .where(TokenizedAsset.issuer_user_id == issuer_user_id)
            .options(
                selectinload(TokenizedAsset.ip_claim),
                selectinload(TokenizedAsset.listing),
            )
            .order_by(TokenizedAsset.created_at.desc())
        )
        result = await db.execute(stmt)
        return list(result.scalars().unique().all())

    @classmethod
    async def prepare_tokenization(
        cls,
        db: AsyncSession,
        current_user: User,
        payload: TokenizationPrepareRequest,
    ) -> TokenizedAsset:
        claim, wallet = await BlockchainAccessService.ensure_issuer_tokenization_allowed(
            db,
            current_user,
            payload.claim_id,
        )

        stmt = (
            select(TokenizedAsset)
            .where(TokenizedAsset.ip_claim_id == payload.claim_id)
            .options(selectinload(TokenizedAsset.listing))
        )
        result = await db.execute(stmt)
        existing = result.scalar_one_or_none()
        asset_id = cls.build_asset_id(payload.claim_id)

        if existing and existing.status not in {
            TokenizedAssetStatus.draft.value,
            TokenizedAssetStatus.failed.value,
        }:
            if (
                existing.total_shares != payload.total_shares
                or existing.sale_supply != payload.sale_supply
                or existing.issuer_reserve != payload.issuer_reserve
                or existing.platform_reserve != payload.platform_reserve
            ):
                raise HTTPException(
                    status_code=409,
                    detail="Tokenization has already progressed on this claim and cannot be reconfigured",
                )
            return existing

        if existing is None:
            existing = TokenizedAsset(
                ip_claim_id=claim.id,
                issuer_user_id=current_user.id,
                issuer_wallet_address=wallet.wallet_address,
                asset_id=asset_id,
                total_shares=payload.total_shares,
                sale_supply=payload.sale_supply,
                issuer_reserve=payload.issuer_reserve,
                platform_reserve=payload.platform_reserve,
                revoke_mint_authority_requested=payload.revoke_mint_authority,
                metadata_snapshot=cls.build_claim_snapshot(claim),
                status=TokenizedAssetStatus.draft.value,
            )
            db.add(existing)
        else:
            existing.issuer_wallet_address = wallet.wallet_address
            existing.asset_id = asset_id
            existing.total_shares = payload.total_shares
            existing.sale_supply = payload.sale_supply
            existing.issuer_reserve = payload.issuer_reserve
            existing.platform_reserve = payload.platform_reserve
            existing.revoke_mint_authority_requested = payload.revoke_mint_authority
            existing.metadata_snapshot = cls.build_claim_snapshot(claim)
            existing.status = TokenizedAssetStatus.draft.value
            existing.last_error = None

        await db.flush()
        await db.refresh(existing)

        await AuditService.write(
            db,
            action="blockchain.tokenization_prepared",
            entity_type="tokenized_asset",
            entity_id=str(existing.id),
            actor_id=current_user.id,
            payload={
                "claim_id": str(claim.id),
                "asset_id": existing.asset_id,
                "total_shares": existing.total_shares,
                "sale_supply": existing.sale_supply,
                "issuer_reserve": existing.issuer_reserve,
                "platform_reserve": existing.platform_reserve,
                "revoke_mint_authority": payload.revoke_mint_authority,
            },
        )
        return existing

    @classmethod
    async def get_asset_for_user(
        cls,
        db: AsyncSession,
        current_user: User,
        tokenization_id: uuid.UUID,
    ) -> TokenizedAsset:
        return await BlockchainAccessService.ensure_tokenized_asset_access(
            db,
            current_user,
            tokenization_id,
        )

    @classmethod
    async def submit_step(
        cls,
        db: AsyncSession,
        current_user: User,
        tokenization_id: uuid.UUID,
        operation: BlockchainOperation,
        payload: TransactionSubmitRequest,
        client: SolanaBlockchainClient,
    ) -> tuple[TokenizedAsset, object]:
        if operation not in cls.TOKENIZATION_STEPS:
            raise HTTPException(status_code=400, detail=f"{operation.value} is not a tokenization step")

        asset = await cls.get_asset_for_user(db, current_user, tokenization_id)
        wallet = await BlockchainAccessService.get_primary_solana_wallet(db, current_user.id)
        if not wallet or wallet.wallet_address != payload.wallet_address:
            raise HTTPException(status_code=400, detail="Submitting wallet does not match the issuer primary wallet")

        transaction = await BlockchainSyncService.confirm_tokenization_step(
            db=db,
            asset=asset,
            operation=operation,
            submission=payload,
            client=client,
        )

        await AuditService.write(
            db,
            action=f"blockchain.{operation.value}.confirmed",
            entity_type="tokenized_asset",
            entity_id=str(asset.id),
            actor_id=current_user.id,
            payload={"tx_signature": payload.tx_signature},
        )
        return asset, transaction
