from __future__ import annotations

import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.blockchain import AssetListing, TokenizedAsset
from app.models.ip_claim import IpClaim, IpClaimStatus
from app.models.user import KYCCase, KYCCaseStatus, User, UserRole, UserStatus, VerificationCase, VerificationStatus, WalletLink


class BlockchainAccessService:
    @staticmethod
    async def get_primary_solana_wallet(
        db: AsyncSession, user_id: uuid.UUID
    ) -> WalletLink | None:
        stmt = (
            select(WalletLink)
            .where(
                WalletLink.user_id == user_id,
                WalletLink.network == "solana",
            )
            .order_by(WalletLink.is_primary.desc(), WalletLink.created_at.asc())
        )
        result = await db.execute(stmt)
        return result.scalars().first()

    @staticmethod
    async def get_latest_verification_case(
        db: AsyncSession, user_id: uuid.UUID
    ) -> VerificationCase | None:
        stmt = (
            select(VerificationCase)
            .where(VerificationCase.user_id == user_id)
            .order_by(VerificationCase.created_at.desc())
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_latest_kyc_case(
        db: AsyncSession, user_id: uuid.UUID
    ) -> KYCCase | None:
        stmt = (
            select(KYCCase)
            .where(KYCCase.user_id == user_id)
            .order_by(KYCCase.created_at.desc())
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @classmethod
    async def ensure_issuer_tokenization_allowed(
        cls,
        db: AsyncSession,
        current_user: User,
        claim_id: uuid.UUID,
    ) -> tuple[IpClaim, WalletLink]:
        if current_user.role != UserRole.issuer.value:
            raise HTTPException(status_code=403, detail="Only issuers can tokenize approved IP claims")
        if current_user.status != UserStatus.active.value:
            raise HTTPException(status_code=403, detail="Only active issuers can tokenize assets")

        wallet = await cls.get_primary_solana_wallet(db, current_user.id)
        if not wallet:
            raise HTTPException(status_code=400, detail="A primary Solana wallet is required")

        verification_case = await cls.get_latest_verification_case(db, current_user.id)
        if not verification_case or verification_case.status != VerificationStatus.approved.value:
            raise HTTPException(
                status_code=403,
                detail="Issuer verification must be approved before tokenization",
            )

        stmt = select(IpClaim).where(IpClaim.id == claim_id)
        claim_result = await db.execute(stmt)
        claim = claim_result.scalar_one_or_none()
        if not claim:
            raise HTTPException(status_code=404, detail="IP claim not found")
        if claim.issuer_user_id != current_user.id:
            raise HTTPException(status_code=403, detail="You can tokenize only your own approved IP claims")
        if claim.status != IpClaimStatus.approved.value:
            raise HTTPException(status_code=400, detail="Only approved IP claims can be tokenized")

        return claim, wallet

    @classmethod
    async def ensure_investor_purchase_allowed(
        cls,
        db: AsyncSession,
        current_user: User,
    ) -> WalletLink:
        if current_user.role != UserRole.investor.value:
            raise HTTPException(status_code=403, detail="Only investors can buy primary sale shares")
        if current_user.status != UserStatus.active.value:
            raise HTTPException(status_code=403, detail="Only active investors can buy primary sale shares")

        wallet = await cls.get_primary_solana_wallet(db, current_user.id)
        if not wallet:
            raise HTTPException(status_code=400, detail="A primary Solana wallet is required")

        latest_kyc = await cls.get_latest_kyc_case(db, current_user.id)
        if latest_kyc and latest_kyc.status != KYCCaseStatus.approved.value:
            raise HTTPException(
                status_code=403,
                detail="Investor KYC must be approved before purchases",
            )

        latest_verification = await cls.get_latest_verification_case(db, current_user.id)
        if latest_verification and latest_verification.status not in {
            VerificationStatus.approved.value,
            VerificationStatus.not_started.value,
        }:
            raise HTTPException(
                status_code=403,
                detail="Account verification is not eligible for primary purchases",
            )

        return wallet

    @classmethod
    async def ensure_tokenized_asset_access(
        cls,
        db: AsyncSession,
        current_user: User,
        tokenization_id: uuid.UUID,
    ) -> TokenizedAsset:
        from sqlalchemy.orm import selectinload

        stmt = (
            select(TokenizedAsset)
            .where(TokenizedAsset.id == tokenization_id)
            .options(
                selectinload(TokenizedAsset.ip_claim),
                selectinload(TokenizedAsset.listing),
            )
        )
        result = await db.execute(stmt)
        asset = result.scalar_one_or_none()
        if not asset:
            raise HTTPException(status_code=404, detail="Tokenized asset not found")
        if current_user.role != UserRole.admin.value and asset.issuer_user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        return asset

    @classmethod
    async def ensure_listing_owner_access(
        cls,
        db: AsyncSession,
        current_user: User,
        listing_id: uuid.UUID,
    ) -> AssetListing:
        from sqlalchemy.orm import selectinload

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
        if listing.tokenized_asset.issuer_user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Only the issuer can manage this listing")
        return listing
