import uuid
from pydantic import BaseModel, EmailStr, field_validator
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
    legal_name: Optional[str] = None
    country: Optional[str] = None


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
    status: str
    reviewer_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
