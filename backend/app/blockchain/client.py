from __future__ import annotations

import base64
import struct
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import httpx

from app.blockchain.coding import anchor_account_discriminator, b58encode
from app.core.config import Settings, settings


class BlockchainClientError(RuntimeError):
    pass


@dataclass(slots=True)
class SignatureStatus:
    slot: int | None
    confirmations: int | None
    confirmation_status: str | None
    err: dict[str, Any] | None


@dataclass(slots=True)
class AssetConfigAccount:
    address: str
    asset_id: str
    issuer: str
    mint: str
    total_shares: int
    minted_supply: int
    sale_supply: int
    mint_bump: int
    asset_bump: int
    is_minted: bool


@dataclass(slots=True)
class FractionConfigAccount:
    address: str
    asset: str
    issuer: str
    mint: str
    total_shares: int
    sale_supply: int
    issuer_reserve: int
    platform_reserve: int
    sale_deposited: bool
    is_locked: bool
    bump: int


@dataclass(slots=True)
class ListingStateAccount:
    address: str
    asset: str
    fraction_config: str
    issuer: str
    mint: str
    sale_vault: str
    platform_treasury: str
    price_per_share_lamports: int
    remaining_supply: int
    start_ts: datetime
    end_ts: datetime
    platform_fee_bps: int
    trade_count: int
    is_active: bool
    bump: int


@dataclass(slots=True)
class TradeReceiptAccount:
    address: str
    listing: str
    buyer: str
    issuer: str
    mint: str
    qty: int
    unit_price_lamports: int
    gross_amount_lamports: int
    fee_amount_lamports: int
    net_amount_lamports: int
    trade_index: int
    timestamp: datetime
    bump: int


class _Decoder:
    def __init__(self, payload: bytes):
        self.payload = payload
        self.offset = 0

    def read_u8(self) -> int:
        value = self.payload[self.offset]
        self.offset += 1
        return value

    def read_bool(self) -> bool:
        return bool(self.read_u8())

    def read_u16(self) -> int:
        value = struct.unpack_from("<H", self.payload, self.offset)[0]
        self.offset += 2
        return value

    def read_u64(self) -> int:
        value = struct.unpack_from("<Q", self.payload, self.offset)[0]
        self.offset += 8
        return value

    def read_i64(self) -> int:
        value = struct.unpack_from("<q", self.payload, self.offset)[0]
        self.offset += 8
        return value

    def read_pubkey(self) -> str:
        value = self.payload[self.offset:self.offset + 32]
        self.offset += 32
        return b58encode(value)

    def read_string(self) -> str:
        length = struct.unpack_from("<I", self.payload, self.offset)[0]
        self.offset += 4
        value = self.payload[self.offset:self.offset + length]
        self.offset += length
        return value.decode("utf-8")


class SolanaBlockchainClient:
    def __init__(self, app_settings: Settings | None = None):
        self.settings = app_settings or settings

    async def get_signature_status(self, signature: str) -> SignatureStatus | None:
        result = await self._rpc(
            "getSignatureStatuses",
            [[signature], {"searchTransactionHistory": True}],
        )
        value = result["value"][0]
        if value is None:
            return None
        return SignatureStatus(
            slot=value.get("slot"),
            confirmations=value.get("confirmations"),
            confirmation_status=value.get("confirmationStatus"),
            err=value.get("err"),
        )

    async def get_asset_config(self, address: str) -> AssetConfigAccount:
        account_data = await self._get_program_account_data(address)
        decoder = self._expect_account(account_data, "AssetConfig")
        return AssetConfigAccount(
            address=address,
            asset_id=decoder.read_string(),
            issuer=decoder.read_pubkey(),
            mint=decoder.read_pubkey(),
            total_shares=decoder.read_u64(),
            minted_supply=decoder.read_u64(),
            sale_supply=decoder.read_u64(),
            mint_bump=decoder.read_u8(),
            asset_bump=decoder.read_u8(),
            is_minted=decoder.read_bool(),
        )

    async def get_fraction_config(self, address: str) -> FractionConfigAccount:
        account_data = await self._get_program_account_data(address)
        decoder = self._expect_account(account_data, "FractionConfig")
        return FractionConfigAccount(
            address=address,
            asset=decoder.read_pubkey(),
            issuer=decoder.read_pubkey(),
            mint=decoder.read_pubkey(),
            total_shares=decoder.read_u64(),
            sale_supply=decoder.read_u64(),
            issuer_reserve=decoder.read_u64(),
            platform_reserve=decoder.read_u64(),
            sale_deposited=decoder.read_bool(),
            is_locked=decoder.read_bool(),
            bump=decoder.read_u8(),
        )

    async def get_listing_state(self, address: str) -> ListingStateAccount:
        account_data = await self._get_program_account_data(address)
        decoder = self._expect_account(account_data, "ListingState")
        return ListingStateAccount(
            address=address,
            asset=decoder.read_pubkey(),
            fraction_config=decoder.read_pubkey(),
            issuer=decoder.read_pubkey(),
            mint=decoder.read_pubkey(),
            sale_vault=decoder.read_pubkey(),
            platform_treasury=decoder.read_pubkey(),
            price_per_share_lamports=decoder.read_u64(),
            remaining_supply=decoder.read_u64(),
            start_ts=datetime.fromtimestamp(decoder.read_i64(), tz=timezone.utc),
            end_ts=datetime.fromtimestamp(decoder.read_i64(), tz=timezone.utc),
            platform_fee_bps=decoder.read_u16(),
            trade_count=decoder.read_u64(),
            is_active=decoder.read_bool(),
            bump=decoder.read_u8(),
        )

    async def get_trade_receipt(self, address: str) -> TradeReceiptAccount:
        account_data = await self._get_program_account_data(address)
        decoder = self._expect_account(account_data, "TradeReceipt")
        return TradeReceiptAccount(
            address=address,
            listing=decoder.read_pubkey(),
            buyer=decoder.read_pubkey(),
            issuer=decoder.read_pubkey(),
            mint=decoder.read_pubkey(),
            qty=decoder.read_u64(),
            unit_price_lamports=decoder.read_u64(),
            gross_amount_lamports=decoder.read_u64(),
            fee_amount_lamports=decoder.read_u64(),
            net_amount_lamports=decoder.read_u64(),
            trade_index=decoder.read_u64(),
            timestamp=datetime.fromtimestamp(decoder.read_i64(), tz=timezone.utc),
            bump=decoder.read_u8(),
        )

    async def _get_program_account_data(self, address: str) -> bytes:
        result = await self._rpc(
            "getAccountInfo",
            [
                address,
                {
                    "encoding": "base64",
                    "commitment": self.settings.SOLANA_COMMITMENT,
                },
            ],
        )
        value = result.get("value")
        if not value:
            raise BlockchainClientError(f"Account {address} was not found on-chain")
        if value.get("owner") != self.settings.SOLANA_PROGRAM_ID:
            raise BlockchainClientError(
                f"Account {address} is not owned by configured program {self.settings.SOLANA_PROGRAM_ID}"
            )
        data = value.get("data") or []
        if not data:
            raise BlockchainClientError(f"Account {address} returned empty data")
        return base64.b64decode(data[0])

    def _expect_account(self, raw_data: bytes, name: str) -> _Decoder:
        discriminator = anchor_account_discriminator(name)
        if raw_data[:8] != discriminator:
            raise BlockchainClientError(f"Unexpected account discriminator for {name}")
        return _Decoder(raw_data[8:])

    async def _rpc(self, method: str, params: list[Any]) -> dict[str, Any]:
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
            "params": params,
        }
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(self.settings.SOLANA_RPC_URL, json=payload)
                response.raise_for_status()
        except httpx.HTTPError as exc:
            raise BlockchainClientError(
                f"RPC call {method} failed against {self.settings.SOLANA_RPC_URL}"
            ) from exc

        body = response.json()
        if body.get("error"):
            raise BlockchainClientError(
                f"RPC error for {method}: {body['error']}"
            )
        return body["result"]
