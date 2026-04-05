"""Admin schemas for user and patent management endpoints.

Provides:
- UserAdminResponse / UserAdminDetailResponse
- UserAdminUpdateRequest / UserStatusUpdateRequest
- PatentAdminResponse / PatentAdminDetailResponse
- PatentStatusUpdateRequest
"""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.models.user import UserRole, UserStatus
from app.models.patent import PatentStatus


# ---------------------------------------------------------------------------
# User admin schemas
# ---------------------------------------------------------------------------

class ProfileAdminRead(BaseModel):
    """Nested profile data for admin responses."""
    full_name: Optional[str] = None
    country: Optional[str] = None
    organization_name: Optional[str] = None
    preferred_language: Optional[str] = None

    model_config = {"from_attributes": True}


class UserAdminResponse(BaseModel):
    """Base admin user response."""
    id: uuid.UUID
    email: str
    role: UserRole
    status: UserStatus
    created_at: datetime
    updated_at: datetime
    profile: Optional[ProfileAdminRead] = None

    model_config = {"from_attributes": True}


class PaginationMeta(BaseModel):
    """Pagination metadata."""
    total: int
    skip: int
    limit: int
    items: int


class UserAdminListResponse(BaseModel):
    """Paginated list of users."""
    total: int
    skip: int
    limit: int
    items: list[UserAdminResponse]


class UserAdminDetailResponse(UserAdminResponse):
    """Detailed user response with additional relations."""
    kyc_status: Optional[str] = None
    wallet_count: int = 0
    verification_status: Optional[str] = None


class UserAdminUpdateRequest(BaseModel):
    """Request body for updating user by admin."""
    full_name: Optional[str] = None
    country: Optional[str] = None
    organization_name: Optional[str] = None
    preferred_language: Optional[str] = None
    role: Optional[UserRole] = None


class UserStatusUpdateRequest(BaseModel):
    """Request body for changing user status."""
    status: UserStatus
    reason: str = Field(..., min_length=5)


class UserStatusUpdateResponse(BaseModel):
    """Response after status change."""
    success: bool = True
    user_id: uuid.UUID
    new_status: UserStatus


class UserDeleteResponse(BaseModel):
    """Response after soft delete."""
    success: bool = True
    user_id: uuid.UUID


# ---------------------------------------------------------------------------
# Patent admin schemas
# ---------------------------------------------------------------------------

class PatentOwnerProfileRead(BaseModel):
    """Nested owner profile for patent admin responses."""
    full_name: Optional[str] = None
    country: Optional[str] = None
    organization_name: Optional[str] = None

    model_config = {"from_attributes": True}


class PatentReviewRead(BaseModel):
    """Patent review data for admin responses."""
    id: uuid.UUID
    reviewer_user_id: Optional[uuid.UUID] = None
    decision: str
    notes: Optional[str] = None
    reviewed_at: datetime

    model_config = {"from_attributes": True}


class PatentAdminResponse(BaseModel):
    """Base admin patent response."""
    id: uuid.UUID
    patent_number: Optional[str] = None
    jurisdiction: Optional[str] = None
    title: str
    status: PatentStatus
    owner_user_id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class PatentAdminListResponse(BaseModel):
    """Paginated list of patents."""
    total: int
    skip: int
    limit: int
    items: list[PatentAdminResponse]


class PatentAdminDetailResponse(PatentAdminResponse):
    """Detailed patent response with relations."""
    owner_profile: Optional[PatentOwnerProfileRead] = None
    documents_count: int = 0
    reviews: list[PatentReviewRead] = []


class PatentStatusUpdateRequest(BaseModel):
    """Request body for changing patent status."""
    status: PatentStatus
    notes: str


class PatentStatusUpdateResponse(BaseModel):
    """Response after patent status change."""
    success: bool = True
    patent_id: uuid.UUID
    new_status: PatentStatus
