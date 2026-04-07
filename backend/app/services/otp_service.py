"""OTP generation, Redis storage, verification and delivery dispatch.

OTP codes are stored in Redis as HMAC-SHA256 hashes with TTL-based expiry.
Delivery is dispatched to email (SMTP) or phone (SMS) based on identifier format
and ENABLE_SMS_OTP configuration flag.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import secrets
import time
from typing import Literal

from fastapi import HTTPException
from redis.asyncio import Redis

from app.core.config import settings
from app.services.otp_sender import send_email_otp, send_sms_otp

# ============================================================================
# Constants
# ============================================================================

OTP_TTL = 300  # 5 minutes for Redis OTP
MAX_ATTEMPTS = 5
VALID_PURPOSES = {
    "register",
    "login",
    "password_reset",
    "issuer_upgrade",
    "patent_submission",
    "patent_submission_phone",
}
HMAC_SECRET = os.environ.get("OTP_HMAC_SECRET", "change-me")

logger = logging.getLogger(__name__)

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

    Delivery logic:
    - Email identifier → always send via email (SMTP)
    - Phone identifier + ENABLE_SMS_OTP=True → send via SMS
    - Phone identifier + ENABLE_SMS_OTP=False → fallback to email with warning log

    Args:
        redis: Redis connection (redis.asyncio).
        identifier: Email address or E.164 phone number.
        purpose: OTP purpose — "register" | "login" | "password_reset".

    Raises:
        ValueError: With "INVALID_IDENTIFIER" or "INVALID_PURPOSE".
        HTTPException: 501 if SMS delivery fails when ENABLE_SMS_OTP=True.
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

    # Delivery dispatch
    if id_type == "email":
        send_email_otp(normalized, code, purpose)
    else:
        # Phone identifier
        if settings.ENABLE_SMS_OTP:
            try:
                send_sms_otp(normalized, code, purpose)
            except NotImplementedError as exc:
                raise HTTPException(
                    status_code=501,
                    detail={
                        "code": "SMS_DELIVERY_FAILED",
                        "message": "SMS OTP delivery failed. Provider not configured.",
                    },
                ) from exc
        else:
            # Fallback: log warning, show code in dev mode
            logger.warning(
                "SMS OTP requested for %s but ENABLE_SMS_OTP=False. "
                "OTP code (dev only): %s", normalized, code
            )


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
