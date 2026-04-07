from __future__ import annotations

import hashlib
from dataclasses import asdict, is_dataclass
from datetime import datetime
from typing import Any

_BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


def b58encode(data: bytes) -> str:
    if not data:
        return ""

    number = int.from_bytes(data, "big")
    encoded = ""
    while number > 0:
        number, remainder = divmod(number, 58)
        encoded = _BASE58_ALPHABET[remainder] + encoded

    leading_zeros = len(data) - len(data.lstrip(b"\0"))
    return ("1" * leading_zeros) + (encoded or "1")


def anchor_account_discriminator(name: str) -> bytes:
    return hashlib.sha256(f"account:{name}".encode("utf-8")).digest()[:8]


def serialize_snapshot(value: Any) -> Any:
    if is_dataclass(value):
        return serialize_snapshot(asdict(value))
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {key: serialize_snapshot(item) for key, item in value.items()}
    if isinstance(value, list):
        return [serialize_snapshot(item) for item in value]
    return value
