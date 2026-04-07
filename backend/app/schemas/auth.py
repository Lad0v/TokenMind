from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Literal

from app.models.user import UserRole


# ============================================================================
# Registration schemas (v3.0 — wallet required for all)
# ============================================================================

class RegisterRequest(BaseModel):
    """Registration request — requires email + solana_wallet_address.

    - investor (default): Active immediately, wallet required
    - issuer: Not allowed directly — must upgrade from investor via patent flow
    """
    email: EmailStr
    solana_wallet_address: str = Field(..., min_length=32, max_length=44)
    role: Literal["investor"] = "investor"  # Only investor allowed on register
    legal_name: str | None = Field(default=None, min_length=1, max_length=255)
    country: str | None = Field(
        default=None,
        min_length=2,
        max_length=3,
        description="ISO country code (2-3 letters), e.g. US or GBR",
        examples=["US"],
    )

    @field_validator("legal_name")
    @classmethod
    def normalize_legal_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip()

    @field_validator("country")
    @classmethod
    def normalize_country(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().upper()
        if not normalized.isalpha() or len(normalized) not in {2, 3}:
            raise ValueError("Country must be a 2-3 letter ISO country code")
        return normalized

    model_config = {
        "json_schema_extra": {
            "example": {
                "email": "user@example.com",
                "solana_wallet_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRrJosgAsU",
                "role": "investor",
                "legal_name": "Jane Doe",
                "country": "US",
            }
        }
    }


class RegisterResponse(BaseModel):
    message: str


# ============================================================================
# Wallet login schemas
# ============================================================================

class WalletLoginRequest(BaseModel):
    """Login via Solana wallet address."""
    wallet_address: str = Field(..., min_length=32, max_length=44)
    network: str = Field(default="solana")


class WalletLoginResponse(BaseModel):
    """Response for wallet login."""
    access_token: str
    refresh_token: str
    role: str
    is_new_user: bool  # True if registered now, False if existing user


# ============================================================================
# Patent submission OTP flow schemas
# ============================================================================

class PatentSubmissionRequest(BaseModel):
    """Initial patent submission — requires email + phone for OTP."""
    patent_number: str = Field(min_length=3, max_length=100)
    patent_title: str = Field(min_length=2, max_length=255)
    claimed_owner_name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    phone: str = Field(..., min_length=7, max_length=20, description="Phone in E.164 format, e.g. +1234567890")
    description: str | None = None
    jurisdiction: str = "US"


class PatentSubmissionResponse(BaseModel):
    """Response after initial patent submission — tells frontend where OTP was sent."""
    message: str
    otp_sent_to: str  # Masked email/phone, e.g. "j***@example.com" or "+***7890"
    otp_purpose: str = "patent_submission"
    submission_id: str | None = None


class PatentOtpVerifyRequest(BaseModel):
    """OTP verification for patent submission."""
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)
    submission_id: str  # To link back to the pending submission


class PatentOtpVerifyResponse(BaseModel):
    """Response after successful patent OTP verification."""
    verified: bool
    role_upgraded: bool = False
    new_role: str | None = None
    access_token: str | None = None
    refresh_token: str | None = None


# ============================================================================
# Existing schemas
# ============================================================================

class LoginResponse(BaseModel):
    """Login response — not used anymore, wallet login is the only way."""
    message: str = "Use wallet login: POST /api/v1/auth/login/wallet"


class LoginWithTokenResponse(BaseModel):
    """Legacy login response with tokens (kept for backward compatibility if needed)."""
    role: UserRole
    access_token: str | None = None
    refresh_token: str | None = None


class OtpSendRequest(BaseModel):
    """OTP send request with generic identifier."""

    identifier: str
    purpose: str


class OtpVerifyRequest(BaseModel):
    """OTP verification request."""

    identifier: str
    code: str = Field(min_length=6, max_length=6)
    purpose: str


class LoginRequest(BaseModel):
    """Deprecated — use wallet login instead."""
    email: EmailStr
    password: str


class PasswordResetRequest(BaseModel):
    email: EmailStr
    new_password: str = Field(min_length=8, max_length=128)


class PasswordResetResponse(BaseModel):
    message: str


class GenericSuccessResponse(BaseModel):
    success: bool = True
    message: str


class AuthMeResponse(BaseModel):
    id: str
    email: str | None  # Nullable for wallet-only users
    name: str | None
    role: UserRole
    status: str
    verification_status: str | None
