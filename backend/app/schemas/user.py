import uuid
from pydantic import BaseModel, EmailStr, Field, field_validator
from datetime import datetime
from typing import Optional

from app.models.user import UserRole, UserStatus


class UserBase(BaseModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def normalise_email(cls, v: str) -> str:
        return v.lower().strip()


class UserRead(UserBase):
    id: uuid.UUID
    role: UserRole
    status: UserStatus
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProfileRead(BaseModel):
    legal_name: Optional[str] = None
    country: Optional[str] = None


class ProfileUpdate(BaseModel):
    legal_name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    country: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=3,
        description="ISO country code (2-3 letters)",
        examples=["US"],
    )

    @field_validator("legal_name")
    @classmethod
    def normalise_legal_name(cls, v: str | None) -> str | None:
        if v is None:
            return None
        return v.strip()

    @field_validator("country")
    @classmethod
    def normalise_country(cls, v: str | None) -> str | None:
        if v is None:
            return None
        normalized = v.strip().upper()
        if not normalized.isalpha() or len(normalized) not in {2, 3}:
            raise ValueError("Country must be a 2-3 letter ISO country code")
        return normalized


class WalletLinkCreate(BaseModel):
    wallet_address: str
    network: str = "solana-devnet"
    is_primary: bool = True

    @field_validator("wallet_address")
    @classmethod
    def normalise_wallet_address(cls, value: str) -> str:
        return value.strip()

    @field_validator("network")
    @classmethod
    def normalise_network(cls, value: str) -> str:
        return value.strip().lower()


class WalletLinkRead(BaseModel):
    id: uuid.UUID
    wallet_address: str
    network: str
    is_primary: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class VerificationCaseRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    patent_name: Optional[str] = None
    patent_address: Optional[str] = None
    user_address: Optional[str] = None
    id_document_url: Optional[str] = None
    selfie_url: Optional[str] = None
    video_url: Optional[str] = None
    status: str
    reviewer_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# New schemas for verification flow (to_change.md #19)
class PatentOwnerInfo(BaseModel):
    """Patent owner information from database."""
    patent_number: str
    title: str
    owner_name: Optional[str] = None
    owner_address: Optional[str] = None


class VerificationPrecheckRequest(BaseModel):
    """Request to start verification with patent data."""
    patent_number: str
    user_address: str  # User's actual address


class VerificationPrecheckResponse(BaseModel):
    """Response with patent owner info for verification."""
    patent_number: str
    patent_title: str
    owner_name_from_patent: Optional[str] = None
    owner_address_from_patent: Optional[str] = None
    message: str


# Wallet Link schemas
class WalletLinkCreate(BaseModel):
    """Request to add a wallet address."""
    wallet_address: str
    network: str = "solana"
    is_primary: bool = False


class WalletLinkRead(BaseModel):
    """Wallet link information."""
    id: uuid.UUID
    user_id: uuid.UUID
    wallet_address: str
    network: str
    is_primary: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
