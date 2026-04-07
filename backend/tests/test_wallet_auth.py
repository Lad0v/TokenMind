from __future__ import annotations

import base64
from datetime import datetime, timedelta, timezone

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import UserRole, VerificationCase, VerificationStatus
from app.services.user_service import UserService

_BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


def _encode_base58(value: bytes) -> str:
    number = int.from_bytes(value, "big")
    encoded = ""

    while number:
        number, remainder = divmod(number, 58)
        encoded = _BASE58_ALPHABET[remainder] + encoded

    leading_zeroes = len(value) - len(value.lstrip(b"\x00"))
    return ("1" * leading_zeroes) + (encoded or "1")


async def test_wallet_login_challenge_and_verify_success(
    client: AsyncClient,
    db_session: AsyncSession,
):
    private_key = Ed25519PrivateKey.generate()
    public_key_bytes = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )
    wallet_address = _encode_base58(public_key_bytes)

    await UserService.create_investor_user(
        db_session,
        email="wallet-login@example.com",
        wallet_address=wallet_address,
    )

    challenge_response = await client.post(
        "/api/v1/auth/wallet/challenge",
        json={
            "wallet_address": wallet_address,
            "network": "solana-devnet",
        },
    )
    assert challenge_response.status_code == 200

    challenge = challenge_response.json()
    assert challenge["wallet_address"] == wallet_address
    assert challenge["network"] == "solana-devnet"
    assert "challenge_token" in challenge

    signature = base64.b64encode(
        private_key.sign(challenge["message"].encode("utf-8"))
    ).decode("ascii")

    verify_response = await client.post(
        "/api/v1/auth/wallet/verify",
        json={
            "wallet_address": wallet_address,
            "network": challenge["network"],
            "message": challenge["message"],
            "signature": signature,
            "challenge_token": challenge["challenge_token"],
        },
    )
    assert verify_response.status_code == 200

    payload = verify_response.json()
    assert payload["role"] == UserRole.investor.value
    assert payload["access_token"] is not None
    assert payload["refresh_token"] is not None


async def test_wallet_login_verify_rejects_invalid_signature(
    client: AsyncClient,
    db_session: AsyncSession,
):
    private_key = Ed25519PrivateKey.generate()
    public_key_bytes = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )
    wallet_address = _encode_base58(public_key_bytes)

    await UserService.create_investor_user(
        db_session,
        email="wallet-login-invalid@example.com",
        wallet_address=wallet_address,
    )

    challenge_response = await client.post(
        "/api/v1/auth/wallet/challenge",
        json={
            "wallet_address": wallet_address,
            "network": "solana-devnet",
        },
    )
    assert challenge_response.status_code == 200

    challenge = challenge_response.json()

    verify_response = await client.post(
        "/api/v1/auth/wallet/verify",
        json={
            "wallet_address": wallet_address,
            "network": challenge["network"],
            "message": challenge["message"],
            "signature": base64.b64encode(b"invalid-signature").decode("ascii"),
            "challenge_token": challenge["challenge_token"],
        },
    )
    assert verify_response.status_code == 401
    assert verify_response.json()["detail"] == "Невалидная подпись кошелька"


async def test_wallet_login_auth_me_works_with_multiple_verification_cases(
    client: AsyncClient,
    db_session: AsyncSession,
):
    private_key = Ed25519PrivateKey.generate()
    public_key_bytes = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )
    wallet_address = _encode_base58(public_key_bytes)

    user = await UserService.create_investor_user(
        db_session,
        email="wallet-login-me@example.com",
        wallet_address=wallet_address,
    )
    await UserService.ensure_initial_verification_case(db_session, user)

    db_session.add(
        VerificationCase(
            user_id=user.id,
            user_address="123 Main St",
            status=VerificationStatus.approved.value,
            created_at=datetime.now(timezone.utc) + timedelta(seconds=1),
        )
    )
    await db_session.flush()

    challenge_response = await client.post(
        "/api/v1/auth/wallet/challenge",
        json={
            "wallet_address": wallet_address,
            "network": "solana-devnet",
        },
    )
    assert challenge_response.status_code == 200
    challenge = challenge_response.json()

    signature = base64.b64encode(
        private_key.sign(challenge["message"].encode("utf-8"))
    ).decode("ascii")

    verify_response = await client.post(
        "/api/v1/auth/wallet/verify",
        json={
            "wallet_address": wallet_address,
            "network": challenge["network"],
            "message": challenge["message"],
            "signature": signature,
            "challenge_token": challenge["challenge_token"],
        },
    )
    assert verify_response.status_code == 200

    access_token = verify_response.json()["access_token"]
    me_response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert me_response.status_code == 200
    payload = me_response.json()
    assert payload["email"] == user.email
    assert payload["verification_status"] == VerificationStatus.approved.value
