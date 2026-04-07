import asyncio
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone
import hashlib

import httpx
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.config import settings
from app.models.marketplace import (
    MarketplaceListing,
    MarketplaceListingStatus,
    MarketplacePurchase,
    MarketplacePurchaseStatus,
)
from app.models.user import User, VerificationStatus
from app.schemas.marketplace import CreateMarketplaceListingRequest
from app.services.user_service import UserService

LAMPORTS_PER_SOL = 1_000_000_000
PURCHASE_RESERVATION_MINUTES = 15


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _make_reference_code() -> str:
    return f"TM-{uuid.uuid4().hex[:10].upper()}"


_BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
_BASE58_ALPHABET_INDEX = {char: index for index, char in enumerate(_BASE58_ALPHABET)}
_BUY_SHARES_DISCRIMINATOR = hashlib.sha256(b"global:buy_shares").digest()[:8]


class MarketplaceService:
    @staticmethod
    def _decode_base58(value: str) -> bytes:
        number = 0
        for char in value.strip():
            if char not in _BASE58_ALPHABET_INDEX:
                raise HTTPException(status_code=400, detail="Invalid base58 payload in Solana transaction")
            number = number * 58 + _BASE58_ALPHABET_INDEX[char]

        decoded = bytearray()
        while number:
            number, remainder = divmod(number, 256)
            decoded.append(remainder)
        decoded = decoded[::-1]

        leading_zeroes = len(value) - len(value.lstrip("1"))
        return b"\x00" * leading_zeroes + bytes(decoded)

    @staticmethod
    def _extract_tokenization_config(listing: MarketplaceListing) -> dict | None:
        metadata = listing.external_metadata or {}
        if not isinstance(metadata, dict):
            return None

        tokenization = metadata.get("tokenization")
        if isinstance(tokenization, dict) and tokenization.get("mode") == "anchor":
            return tokenization
        return None

    @staticmethod
    def _validate_anchor_tokenization_payload(external_metadata: dict | None, mint_address: str | None) -> dict | None:
        if not isinstance(external_metadata, dict):
            return None

        tokenization = external_metadata.get("tokenization")
        if not isinstance(tokenization, dict) or tokenization.get("mode") != "anchor":
            return None

        required_string_fields = [
            "program_id",
            "asset_id",
            "asset_config",
            "fraction_config",
            "listing",
            "sale_vault",
            "vault_authority",
            "mint",
            "issuer_wallet",
            "platform_treasury",
        ]
        missing = [
            field
            for field in required_string_fields
            if not isinstance(tokenization.get(field), str) or not tokenization.get(field, "").strip()
        ]
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"Anchor tokenization metadata is incomplete: missing {', '.join(missing)}",
            )

        if mint_address and tokenization["mint"].strip() != mint_address.strip():
            raise HTTPException(status_code=400, detail="Marketplace mint address does not match Anchor tokenization metadata")

        return tokenization

    @staticmethod
    def _resolve_signer_wallets(transaction: dict) -> set[str]:
        message = (transaction.get("transaction") or {}).get("message") or {}
        account_keys = message.get("accountKeys") or []
        if account_keys and isinstance(account_keys[0], dict):
            return {
                key.get("pubkey")
                for key in account_keys
                if isinstance(key, dict) and key.get("signer") and key.get("pubkey")
            }

        header = message.get("header") or {}
        num_required_signatures = int(header.get("numRequiredSignatures", 0))
        return {
            str(account_keys[index])
            for index in range(min(num_required_signatures, len(account_keys)))
        }

    @staticmethod
    def _resolve_account_keys(message: dict) -> list[str]:
        resolved: list[str] = []
        for key in message.get("accountKeys") or []:
            if isinstance(key, str):
                resolved.append(key)
            elif isinstance(key, dict) and key.get("pubkey"):
                resolved.append(key["pubkey"])
        return resolved

    @staticmethod
    def _resolve_instruction_program_id(instruction: dict, account_keys: list[str]) -> str | None:
        program_id = instruction.get("programId")
        if isinstance(program_id, str):
            return program_id

        program_index = instruction.get("programIdIndex")
        if isinstance(program_index, int) and 0 <= program_index < len(account_keys):
            return account_keys[program_index]
        return None

    @staticmethod
    def _resolve_instruction_accounts(instruction: dict, account_keys: list[str]) -> list[str]:
        resolved: list[str] = []
        for account in instruction.get("accounts") or []:
            if isinstance(account, int) and 0 <= account < len(account_keys):
                resolved.append(account_keys[account])
            elif isinstance(account, str):
                resolved.append(account)
            elif isinstance(account, dict) and account.get("pubkey"):
                resolved.append(account["pubkey"])
        return resolved

    @staticmethod
    async def release_expired_reservations(db: AsyncSession) -> int:
        now = _utcnow()
        stmt = (
            select(MarketplacePurchase)
            .options(joinedload(MarketplacePurchase.listing))
            .where(
                MarketplacePurchase.status == MarketplacePurchaseStatus.pending_payment.value,
                MarketplacePurchase.expires_at < now,
            )
        )
        expired = (await db.execute(stmt)).scalars().all()

        released = 0
        for purchase in expired:
            if purchase.listing:
                purchase.listing.available_tokens += purchase.quantity
                if purchase.listing.status == MarketplaceListingStatus.sold_out.value:
                    purchase.listing.status = MarketplaceListingStatus.active.value
            purchase.status = MarketplacePurchaseStatus.expired.value
            purchase.failure_reason = "Reservation expired before payment confirmation"
            released += 1

        if released:
            await db.flush()
        return released

    @staticmethod
    async def ensure_demo_listings(db: AsyncSession) -> None:
        if not settings.DEBUG:
            return

        count_stmt = select(func.count()).select_from(MarketplaceListing)
        current_count = (await db.execute(count_stmt)).scalar() or 0
        if current_count:
            return

        demo_rows = [
            {
                "title": "NanoSeal Barrier Patent",
                "patent_number": "US-NSP-2026-001",
                "description": "Barrier coating patent prepared for tokenized revenue participation on Solana devnet.",
                "issuer_name": "NanoSeal Labs",
                "category": "Advanced materials",
                "jurisdiction": "US",
                "token_symbol": "NSP",
                "token_name": "NanoSeal Patent",
                "price_per_token_sol": 0.42,
                "total_tokens": 1000,
            },
            {
                "title": "Photon Core Lithography Stack",
                "patent_number": "EU-PHC-2026-014",
                "description": "Photonics manufacturing IP packaged for marketplace access and investor settlement.",
                "issuer_name": "Photon Core GmbH",
                "category": "Semiconductors",
                "jurisdiction": "EU",
                "token_symbol": "PHC",
                "token_name": "Photon Core",
                "price_per_token_sol": 0.88,
                "total_tokens": 600,
            },
            {
                "title": "BioInk Formula Series A",
                "patent_number": "UK-BIF-2026-009",
                "description": "Biotech formulation patent with tokenized access rights for devnet MVP marketplace.",
                "issuer_name": "BioInk Formula Ltd",
                "category": "Biotech",
                "jurisdiction": "UK",
                "token_symbol": "BIF",
                "token_name": "BioInk Formula",
                "price_per_token_sol": 0.36,
                "total_tokens": 800,
            },
        ]

        for row in demo_rows:
            db.add(
                MarketplaceListing(
                    **row,
                    available_tokens=row["total_tokens"],
                    settlement_currency="SOL",
                    network=settings.MARKETPLACE_NETWORK,
                    treasury_wallet_address=settings.MARKETPLACE_TREASURY_WALLET,
                    status=MarketplaceListingStatus.active.value,
                )
            )

        await db.flush()

    @staticmethod
    async def _listing_purchase_metrics(db: AsyncSession) -> dict[uuid.UUID, dict[str, float | int]]:
        stmt = (
            select(
                MarketplacePurchase.listing_id,
                func.count(MarketplacePurchase.id),
                func.coalesce(func.sum(MarketplacePurchase.total_sol), 0.0),
            )
            .where(MarketplacePurchase.status == MarketplacePurchaseStatus.confirmed.value)
            .group_by(MarketplacePurchase.listing_id)
        )
        rows = (await db.execute(stmt)).all()
        metrics: dict[uuid.UUID, dict[str, float | int]] = {}
        for listing_id, purchase_count, volume_sol in rows:
            metrics[listing_id] = {
                "purchase_count": int(purchase_count or 0),
                "volume_sol": float(volume_sol or 0),
            }
        return metrics

    @staticmethod
    async def list_public_listings(db: AsyncSession) -> tuple[list[MarketplaceListing], dict[uuid.UUID, dict[str, float | int]]]:
        await MarketplaceService.release_expired_reservations(db)
        await MarketplaceService.ensure_demo_listings(db)

        stmt = (
            select(MarketplaceListing)
            .where(MarketplaceListing.status.in_([
                MarketplaceListingStatus.active.value,
                MarketplaceListingStatus.sold_out.value,
            ]))
            .order_by(MarketplaceListing.created_at.desc())
        )
        listings = (await db.execute(stmt)).scalars().all()
        metrics = await MarketplaceService._listing_purchase_metrics(db)
        return list(listings), metrics

    @staticmethod
    async def get_listing(db: AsyncSession, listing_id: uuid.UUID) -> MarketplaceListing | None:
        await MarketplaceService.release_expired_reservations(db)
        stmt = select(MarketplaceListing).where(MarketplaceListing.id == listing_id)
        return (await db.execute(stmt)).scalar_one_or_none()

    @staticmethod
    async def create_listing(
        db: AsyncSession,
        payload: CreateMarketplaceListingRequest,
        creator: User,
    ) -> MarketplaceListing:
        anchor_tokenization = MarketplaceService._validate_anchor_tokenization_payload(
            payload.external_metadata,
            payload.mint_address,
        )
        claim = None
        if payload.claim_id:
            from app.models.ip_claim import IpClaim, IpClaimStatus

            claim = await db.get(IpClaim, payload.claim_id)
            if not claim:
                raise HTTPException(status_code=404, detail="IP claim not found")

            if creator.role not in {"admin", "compliance_officer"} and claim.issuer_user_id != creator.id:
                raise HTTPException(status_code=403, detail="You can create listings only for your own approved claims")
            if claim.status != IpClaimStatus.approved.value:
                raise HTTPException(status_code=400, detail="Only approved IP claims can be listed on the marketplace")

        wallets = await UserService.list_wallet_links(db, creator.id)
        linked_wallet_addresses = {wallet.wallet_address for wallet in wallets}
        primary_wallet = next((wallet for wallet in wallets if wallet.is_primary), wallets[0] if wallets else None)

        treasury_wallet_address = (payload.treasury_wallet_address or "").strip() or None
        if anchor_tokenization:
            treasury_wallet_address = anchor_tokenization["issuer_wallet"].strip()

        if creator.role in {"issuer", "user"}:
            if not primary_wallet:
                raise HTTPException(
                    status_code=400,
                    detail="Link a primary Solana wallet before creating a marketplace listing",
                )
            if treasury_wallet_address and treasury_wallet_address not in linked_wallet_addresses:
                raise HTTPException(
                    status_code=400,
                    detail="Marketplace payout wallet must match one of your linked Solana wallets",
                )
            treasury_wallet_address = treasury_wallet_address or primary_wallet.wallet_address
        else:
            if treasury_wallet_address and linked_wallet_addresses and treasury_wallet_address not in linked_wallet_addresses:
                raise HTTPException(
                    status_code=400,
                    detail="Selected payout wallet is not linked to this account",
                )
            if not treasury_wallet_address:
                treasury_wallet_address = primary_wallet.wallet_address if primary_wallet else settings.MARKETPLACE_TREASURY_WALLET

        if not treasury_wallet_address:
            raise HTTPException(status_code=500, detail="Treasury wallet is not configured")

        listing = MarketplaceListing(
            claim_id=payload.claim_id,
            created_by_user_id=creator.id,
            title=payload.title.strip(),
            patent_number=(claim.patent_number if claim else payload.patent_number).strip(),
            description=payload.description.strip() if payload.description else None,
            issuer_name=(
                payload.issuer_name.strip()
                if payload.issuer_name
                else (claim.claimed_owner_name.strip() if claim else creator.email)
            ),
            category=payload.category.strip() if payload.category else None,
            jurisdiction=(
                payload.jurisdiction.strip()
                if payload.jurisdiction
                else (claim.jurisdiction.strip() if claim and claim.jurisdiction else None)
            ),
            token_symbol=payload.token_symbol,
            token_name=payload.token_name.strip() if payload.token_name else None,
            price_per_token_sol=float(payload.price_per_token_sol),
            total_tokens=payload.total_tokens,
            available_tokens=payload.total_tokens,
            settlement_currency="SOL",
            network=payload.network,
            treasury_wallet_address=treasury_wallet_address.strip(),
            mint_address=payload.mint_address.strip() if payload.mint_address else None,
            external_metadata=payload.external_metadata,
            status=MarketplaceListingStatus.active.value,
        )
        db.add(listing)
        await db.flush()
        await db.refresh(listing)
        return listing

    @staticmethod
    async def _ensure_marketplace_buyer(db: AsyncSession, user: User) -> tuple[str, str]:
        if user.role not in {"investor", "admin"}:
            raise HTTPException(status_code=403, detail="Marketplace purchases are available only for investors")

        if user.role != "admin":
            verification = await UserService.get_latest_verification_case(db, user.id)
            verification_status = verification.status if verification else VerificationStatus.not_started.value
            if verification_status != VerificationStatus.approved.value:
                raise HTTPException(
                    status_code=403,
                    detail="KYS verification must be approved before purchasing tokens",
                )

        wallets = await UserService.list_wallet_links(db, user.id)
        primary_wallet = next((wallet for wallet in wallets if wallet.is_primary), wallets[0] if wallets else None)
        if not primary_wallet:
            raise HTTPException(status_code=400, detail="Link a Solana wallet before purchasing")

        return primary_wallet.wallet_address, primary_wallet.network

    @staticmethod
    async def create_purchase_intent(
        db: AsyncSession,
        user: User,
        listing_id: uuid.UUID,
        quantity: int,
    ) -> MarketplacePurchase:
        await MarketplaceService.release_expired_reservations(db)
        wallet_address, wallet_network = await MarketplaceService._ensure_marketplace_buyer(db, user)

        listing = await MarketplaceService.get_listing(db, listing_id)
        if not listing:
            raise HTTPException(status_code=404, detail="Listing not found")
        if listing.status != MarketplaceListingStatus.active.value:
            raise HTTPException(status_code=400, detail="Listing is not active")
        if listing.available_tokens < quantity:
            raise HTTPException(status_code=400, detail="Not enough tokens available")
        if listing.network != wallet_network:
            raise HTTPException(status_code=400, detail="Linked wallet network does not match listing network")

        quoted_total_sol = float(listing.price_per_token_sol * quantity)
        tokenization = MarketplaceService._extract_tokenization_config(listing)
        expected_lamports = int(round(quoted_total_sol * LAMPORTS_PER_SOL))
        total_sol = expected_lamports / LAMPORTS_PER_SOL

        listing.available_tokens -= quantity
        if listing.available_tokens == 0:
            listing.status = MarketplaceListingStatus.sold_out.value

        purchase = MarketplacePurchase(
            user_id=user.id,
            listing_id=listing.id,
            quantity=quantity,
            price_per_token_sol=listing.price_per_token_sol,
            quoted_total_sol=quoted_total_sol,
            total_sol=total_sol,
            expected_lamports=expected_lamports,
            payment_wallet_address=wallet_address,
            treasury_wallet_address=listing.treasury_wallet_address,
            reference_code=_make_reference_code(),
            status=MarketplacePurchaseStatus.pending_payment.value,
            expires_at=_utcnow() + timedelta(minutes=PURCHASE_RESERVATION_MINUTES),
        )
        db.add(purchase)
        await db.flush()
        await db.refresh(purchase)
        return purchase

    @staticmethod
    async def get_purchase_for_user(
        db: AsyncSession,
        purchase_id: uuid.UUID,
        user: User,
    ) -> MarketplacePurchase | None:
        stmt = (
            select(MarketplacePurchase)
            .options(joinedload(MarketplacePurchase.listing))
            .where(
                MarketplacePurchase.id == purchase_id,
                MarketplacePurchase.user_id == user.id,
            )
        )
        return (await db.execute(stmt)).scalar_one_or_none()

    @staticmethod
    async def list_user_purchases(
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> list[MarketplacePurchase]:
        await MarketplaceService.release_expired_reservations(db)
        stmt = (
            select(MarketplacePurchase)
            .options(joinedload(MarketplacePurchase.listing))
            .where(MarketplacePurchase.user_id == user_id)
            .order_by(MarketplacePurchase.created_at.desc())
        )
        return list((await db.execute(stmt)).scalars().all())

    @staticmethod
    async def list_user_holdings(
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> list[dict]:
        purchases = await MarketplaceService.list_user_purchases(db, user_id)
        confirmed = [purchase for purchase in purchases if purchase.status == MarketplacePurchaseStatus.confirmed.value]

        grouped: dict[uuid.UUID, list[MarketplacePurchase]] = defaultdict(list)
        for purchase in confirmed:
            grouped[purchase.listing_id].append(purchase)

        holdings: list[dict] = []
        for listing_id, items in grouped.items():
            listing = items[0].listing
            if not listing:
                continue

            quantity = sum(item.quantity for item in items)
            invested_sol = float(sum(item.quoted_total_sol for item in items))
            latest_price = float(listing.price_per_token_sol)
            avg_price = invested_sol / quantity if quantity else 0
            holdings.append(
                {
                    "listing_id": listing_id,
                    "title": listing.title,
                    "patent_number": listing.patent_number,
                    "issuer_name": listing.issuer_name,
                    "token_symbol": listing.token_symbol,
                    "quantity": quantity,
                    "avg_price_per_token_sol": round(avg_price, 9),
                    "invested_sol": round(invested_sol, 9),
                    "latest_price_per_token_sol": latest_price,
                    "current_value_sol": round(quantity * latest_price, 9),
                    "network": listing.network,
                    "settlement_currency": listing.settlement_currency,
                    "status": listing.status,
                }
            )

        holdings.sort(key=lambda item: item["current_value_sol"], reverse=True)
        return holdings

    @staticmethod
    async def _fetch_solana_transaction(signature: str) -> dict:
        request_payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getTransaction",
            "params": [
                signature,
                {
                    "commitment": "confirmed",
                    "encoding": "jsonParsed",
                    "maxSupportedTransactionVersion": 0,
                },
            ],
        }

        async with httpx.AsyncClient(timeout=20.0) as client:
            for attempt in range(6):
                response = await client.post(settings.SOLANA_RPC_URL, json=request_payload)
                response.raise_for_status()
                payload = response.json()

                if payload.get("error"):
                    raise HTTPException(status_code=400, detail="Unable to verify Solana transaction")

                transaction = payload.get("result")
                if transaction:
                    return transaction

                if attempt < 5:
                    await asyncio.sleep(1.0)

        raise HTTPException(status_code=400, detail="Solana transaction not found or not confirmed yet")

    @staticmethod
    def _extract_matching_transfer(
        transaction: dict,
        source_wallet: str,
        destination_wallet: str,
        expected_lamports: int,
    ) -> dict:
        meta = transaction.get("meta") or {}
        if meta.get("err"):
            raise HTTPException(status_code=400, detail="Solana transaction failed on-chain")

        instructions = (transaction.get("transaction") or {}).get("message", {}).get("instructions", [])
        matching_transfers = []
        for instruction in instructions:
            parsed = instruction.get("parsed")
            if instruction.get("program") != "system" or not parsed:
                continue
            if parsed.get("type") != "transfer":
                continue

            info = parsed.get("info") or {}
            if (
                info.get("source") == source_wallet
                and info.get("destination") == destination_wallet
                and int(info.get("lamports", 0)) == expected_lamports
            ):
                matching_transfers.append(info)

        if not matching_transfers:
            raise HTTPException(
                status_code=400,
                detail="Confirmed transaction does not contain the expected transfer",
            )

        signer_wallets = MarketplaceService._resolve_signer_wallets(transaction)
        if source_wallet not in signer_wallets:
            raise HTTPException(status_code=400, detail="Transaction signer does not match linked wallet")

        return matching_transfers[0]

    @staticmethod
    def _verify_anchor_listing_purchase(
        transaction: dict,
        purchase: MarketplacePurchase,
        tokenization: dict,
    ) -> dict:
        meta = transaction.get("meta") or {}
        if meta.get("err"):
            raise HTTPException(status_code=400, detail="Solana transaction failed on-chain")

        signer_wallets = MarketplaceService._resolve_signer_wallets(transaction)
        if purchase.payment_wallet_address not in signer_wallets:
            raise HTTPException(status_code=400, detail="Transaction signer does not match linked wallet")

        program_id = tokenization.get("program_id")
        listing_address = tokenization.get("listing")
        if not isinstance(program_id, str) or not isinstance(listing_address, str):
            raise HTTPException(status_code=400, detail="Listing is missing Anchor tokenization metadata")

        message = (transaction.get("transaction") or {}).get("message") or {}
        account_keys = MarketplaceService._resolve_account_keys(message)
        instructions = message.get("instructions") or []

        for instruction in instructions:
            resolved_program_id = MarketplaceService._resolve_instruction_program_id(instruction, account_keys)
            if resolved_program_id != program_id:
                continue

            resolved_accounts = MarketplaceService._resolve_instruction_accounts(instruction, account_keys)
            if listing_address not in resolved_accounts:
                continue

            raw_data = instruction.get("data")
            if not isinstance(raw_data, str):
                continue

            decoded = MarketplaceService._decode_base58(raw_data)
            if not decoded.startswith(_BUY_SHARES_DISCRIMINATOR) or len(decoded) < 16:
                continue

            quantity = int.from_bytes(decoded[8:16], byteorder="little", signed=False)
            if quantity != purchase.quantity:
                raise HTTPException(status_code=400, detail="On-chain purchase quantity does not match reservation")

            return {
                "program_id": program_id,
                "listing": listing_address,
                "quantity": quantity,
            }

        raise HTTPException(status_code=400, detail="Confirmed transaction does not contain the expected Anchor purchase instruction")

    @staticmethod
    async def confirm_purchase(
        db: AsyncSession,
        purchase: MarketplacePurchase,
        tx_signature: str,
    ) -> MarketplacePurchase:
        await MarketplaceService.release_expired_reservations(db)

        if purchase.status != MarketplacePurchaseStatus.pending_payment.value:
            raise HTTPException(status_code=400, detail="Purchase is not awaiting payment")
        if purchase.expires_at < _utcnow():
            purchase.status = MarketplacePurchaseStatus.expired.value
            purchase.failure_reason = "Reservation expired before payment confirmation"
            if purchase.listing:
                purchase.listing.available_tokens += purchase.quantity
                if purchase.listing.status == MarketplaceListingStatus.sold_out.value:
                    purchase.listing.status = MarketplaceListingStatus.active.value
            await db.flush()
            raise HTTPException(status_code=400, detail="Purchase reservation has expired")

        duplicate_stmt = select(MarketplacePurchase).where(
            MarketplacePurchase.tx_signature == tx_signature,
            MarketplacePurchase.id != purchase.id,
        )
        duplicate = (await db.execute(duplicate_stmt)).scalar_one_or_none()
        if duplicate:
            raise HTTPException(status_code=400, detail="This Solana transaction was already used")

        transaction = await MarketplaceService._fetch_solana_transaction(tx_signature)
        tokenization = MarketplaceService._extract_tokenization_config(purchase.listing) if purchase.listing else None
        if tokenization:
            transfer_info = MarketplaceService._verify_anchor_listing_purchase(
                transaction=transaction,
                purchase=purchase,
                tokenization=tokenization,
            )
        else:
            transfer_info = MarketplaceService._extract_matching_transfer(
                transaction=transaction,
                source_wallet=purchase.payment_wallet_address,
                destination_wallet=purchase.treasury_wallet_address,
                expected_lamports=purchase.expected_lamports,
            )

        purchase.tx_signature = tx_signature
        purchase.status = MarketplacePurchaseStatus.confirmed.value
        purchase.confirmed_at = _utcnow()
        purchase.failure_reason = None
        purchase.payment_metadata = {
            "slot": transaction.get("slot"),
            "block_time": transaction.get("blockTime"),
            "transfer": transfer_info,
            "mode": "anchor" if tokenization else "sol-transfer",
        }
        await db.flush()
        await db.refresh(purchase)
        return purchase
