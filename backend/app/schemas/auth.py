from pydantic import BaseModel, EmailStr, Field

from app.models.user import UserRole


class LoginResponse(BaseModel):
    role: UserRole
    access_token: str | None = None
    refresh_token: str | None = None


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: UserRole = UserRole.user
    legal_name: str | None = None
    country: str | None = None
    wallet_address: str | None = None


class RegisterResponse(BaseModel):
    message: str
    user_id: str | None = None


class OTPSendRequest(BaseModel):
    """Request for sending OTP — accepts email or phone identifier."""

    identifier: str
    purpose: str  # register | login | password_reset


class OTPSendResponse(BaseModel):
    message: str


class OtpSendRequest(BaseModel):
    """New OTP send request with generic identifier."""

    identifier: str
    purpose: str


class OtpVerifyRequest(BaseModel):
    """OTP verification request."""

    identifier: str
    code: str = Field(min_length=6, max_length=6)
    purpose: str


class OTPVerifyRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)


class OTPVerifyResponse(BaseModel):
    verified: bool
    message: str
    access_token: str | None = None
    refresh_token: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class WalletChallengeRequest(BaseModel):
    wallet_address: str
    network: str = "solana-devnet"


class WalletChallengeResponse(BaseModel):
    wallet_address: str
    network: str
    message: str
    challenge_token: str


class WalletLoginVerifyRequest(BaseModel):
    wallet_address: str
    network: str = "solana-devnet"
    message: str
    signature: str
    challenge_token: str


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
    email: str
    name: str | None
    role: UserRole
    status: str
    verification_status: str | None


class OtpResendRequest(BaseModel):
    identifier: str          # E.164 phone
    purpose: str             # register | login | password_reset
    via: str = "text"        # text | voice
