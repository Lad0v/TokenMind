"""OTP generation, Redis storage, verification and delivery dispatch.

OTP codes are stored in Redis as HMAC-SHA256 hashes with TTL-based expiry.
Delivery is dispatched to email (SMTP) or phone (SMS stub) based on identifier format.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Any, Literal

from fastapi import HTTPException
from redis.asyncio import Redis

from app.services.otp_sender import send_email_otp, send_sms_otp

# ============================================================================
# Constants
# ============================================================================

OTP_TTL = 300  # 5 minutes for Redis OTP
MAX_ATTEMPTS = 5
VALID_PURPOSES = {"register", "login", "password_reset"}
HMAC_SECRET = os.environ.get("OTP_HMAC_SECRET", "change-me")

# ============================================================================
# Identifier classification
# ============================================================================


def _classify_identifier(identifier: str) -> Literal["email", "phone"]:
    """Classify identifier as email or phone.

    Args:
        identifier: User-provided identifier (email or phone).

    Returns:
        "email" if identifier contains '@', "phone" if E.164 format.

    Raises:
        ValueError: With message "INVALID_IDENTIFIER" if format is unrecognized.
    """
    normalized = identifier.strip().lower()
    if "@" in normalized:
        return "email"
    if normalized.startswith("+") and normalized[1:].isdigit():
        return "phone"
    raise ValueError("INVALID_IDENTIFIER")


# ============================================================================
# HMAC helpers
# ============================================================================


def _hash_otp(code: str) -> str:
    """HMAC-SHA256 hash of OTP code."""
    return hmac.new(
        HMAC_SECRET.encode(), code.encode(), hashlib.sha256
    ).hexdigest()


# ============================================================================
# Normalization
# ============================================================================


def _normalize_identifier(identifier: str, purpose: str) -> str:
    """Normalize identifier based on type.

    Email: strip + lowercase.
    Phone: strip only.
    """
    id_type = _classify_identifier(identifier)
    if id_type == "email":
        return identifier.strip().lower()
    return identifier.strip()


# ============================================================================
# Redis-based OTP functions
# ============================================================================


async def generate_and_send_otp(
    redis: Redis,
    identifier: str,
    purpose: str,
) -> None:
    """Generate 6-digit OTP, store in Redis, and send via email or phone.

    Args:
        redis: Redis connection (redis.asyncio).
        identifier: Email address or E.164 phone number.
        purpose: OTP purpose — "register" | "login" | "password_reset".

    Raises:
        ValueError: With "INVALID_IDENTIFIER" or "INVALID_PURPOSE".
        HTTPException: 501 if SMS delivery is requested but not configured.
    """
    if purpose not in VALID_PURPOSES:
        raise ValueError("INVALID_PURPOSE")

    normalized = _normalize_identifier(identifier, purpose)
    id_type = _classify_identifier(identifier)

    code = f"{secrets.randbelow(1_000_000):06d}"
    payload = json.dumps({
        "otp_hash": _hash_otp(code),
        "attempts_left": MAX_ATTEMPTS,
        "expires_at": time.time() + OTP_TTL,
    })
    key = f"otp:{purpose}:{normalized}"
    await redis.set(key, payload, ex=OTP_TTL)

    if id_type == "email":
        send_email_otp(normalized, code, purpose)
    else:
        try:
            send_sms_otp(normalized, code, purpose)
        except NotImplementedError as exc:
            raise HTTPException(
                status_code=501,
                detail={
                    "code": "SMS_NOT_CONFIGURED",
                    "message": "SMS OTP is not available. Use email.",
                },
            ) from exc


async def verify_otp(
    redis: Redis,
    identifier: str,
    code: str,
    purpose: str,
) -> bool:
    """Verify OTP code against Redis-stored HMAC hash.

    Args:
        redis: Redis connection.
        identifier: Email address or E.164 phone number.
        code: Plain-text OTP code to verify.
        purpose: OTP purpose.

    Returns:
        True if code is valid.

    Raises:
        ValueError: With "OTP_EXPIRED", "OTP_BLOCKED", or "OTP_INVALID".
    """
    normalized = _normalize_identifier(identifier, purpose)
    key = f"otp:{purpose}:{normalized}"

    raw = await redis.get(key)
    if not raw:
        raise ValueError("OTP_EXPIRED")

    data = json.loads(raw)

    if data["attempts_left"] <= 0:
        raise ValueError("OTP_BLOCKED")

    code_hash = _hash_otp(code)
    if not hmac.compare_digest(code_hash, data["otp_hash"]):
        data["attempts_left"] -= 1
        remaining_ttl = int(data["expires_at"] - time.time())
        if remaining_ttl > 0:
            await redis.set(key, json.dumps(data), ex=remaining_ttl)
        raise ValueError("OTP_INVALID")

    # Success — delete OTP to prevent reuse
    await redis.delete(key)
    return True


# ============================================================================
# OTPService class (backward-compatible SQLAlchemy-based API)
# ============================================================================


class OTPService:
    """Backward-compatible OTP service using SQLAlchemy storage.

    Existing auth.py endpoints call:
    - OTPService.create_otp(db, user, purpose)
    - OTPService.verify_otp(db, user, code)
    """

    @staticmethod
    def generate_code() -> str:
        import random

        return f"{random.randint(100000, 999999)}"

    @staticmethod
    async def create_otp(
        db: Any, user: Any, purpose: str = "registration"
    ) -> str:
        """Create OTP in database (legacy)."""
        from datetime import datetime, timedelta, timezone

        from app.models.user import OTPCode

        code = OTPService.generate_code()
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
        otp = OTPCode(
            user_id=user.id,
            code=code,
            purpose=purpose,
            expires_at=expires_at,
        )
        db.add(otp)
        await db.flush()
        return code

    @staticmethod
    async def verify_otp(db: Any, user: Any, code: str) -> bool:
        """Verify OTP in database (legacy)."""
        from datetime import datetime, timezone

        from sqlalchemy import select

        from app.models.user import OTPCode

        now = datetime.now(timezone.utc)
        stmt = (
            select(OTPCode)
            .where(
                OTPCode.user_id == user.id,
                OTPCode.code == code,
                OTPCode.is_used.is_(False),
                OTPCode.expires_at > now,
            )
            .order_by(OTPCode.created_at.desc())
        )
        result = await db.execute(stmt)
        otp = result.scalar_one_or_none()
        if not otp:
            return False
        otp.is_used = True
        await db.flush()
        return True
