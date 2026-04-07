"""Admin user management endpoints.

Provides CRUD for users with RBAC (admin only):
- GET    /api/v1/users                  — list users with pagination
- GET    /api/v1/users/{user_id}        — user detail with relations
- PUT    /api/v1/users/{user_id}        — update user profile/role
- PUT    /api/v1/users/{user_id}/status — change user status
- DELETE /api/v1/users/{user_id}        — soft delete user
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import require_roles
from app.models.user import User, UserRole, UserStatus
from app.models.patent import Patent
from app.schemas.admin import (
    UserAdminResponse,
    UserAdminDetailResponse,
    UserAdminListResponse,
    UserAdminUpdateRequest,
    UserStatusUpdateRequest,
    UserStatusUpdateResponse,
    UserDeleteResponse,
    ProfileAdminRead,
)
from app.services.user_service import UserService

router = APIRouter()


def _build_user_admin_response(user: User) -> UserAdminResponse:
    """Build UserAdminResponse from User model."""
    profile = None
    if hasattr(user, "profile") and user.profile:
        profile = ProfileAdminRead(
            full_name=user.profile.full_name,
            country=user.profile.country,
            organization_name=user.profile.organization_name,
            preferred_language=user.profile.preferred_language,
        )
    return UserAdminResponse(
        id=user.id,
        email=user.email,
        role=UserRole(user.role),
        status=UserStatus(user.status),
        created_at=user.created_at,
        updated_at=user.updated_at,
        profile=profile,
    )


def _build_user_admin_detail_response(user: User) -> UserAdminDetailResponse:
    """Build UserAdminDetailResponse from User model."""
    base = _build_user_admin_response(user)

    # Get latest KYC status
    kyc_status = None
    if hasattr(user, "kyc_cases") and user.kyc_cases:
        # Sort by created_at desc and get latest
        latest_kyc = max(user.kyc_cases, key=lambda k: k.created_at)
        kyc_status = latest_kyc.status

    # Get wallet count
    wallet_count = 0
    if hasattr(user, "wallet_links"):
        wallet_count = len(user.wallet_links)

    # Get verification status
    verification_status = None
    if hasattr(user, "verification_cases") and user.verification_cases:
        latest_vc = max(user.verification_cases, key=lambda vc: vc.created_at)
        verification_status = latest_vc.status

    return UserAdminDetailResponse(
        id=base.id,
        email=base.email,
        role=base.role,
        status=base.status,
        created_at=base.created_at,
        updated_at=base.updated_at,
        profile=base.profile,
        kyc_status=kyc_status,
        wallet_count=wallet_count,
        verification_status=verification_status,
    )


@router.get("", response_model=UserAdminListResponse)
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    role: UserRole | None = Query(None),
    status: UserStatus | None = Query(None),
    search: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_roles("admin")),
):
    """List users with filtering and pagination."""
    users, total = await UserService.list_users(
        db=db,
        skip=skip,
        limit=limit,
        role=role,
        status=status,
        search=search,
    )

    items = [_build_user_admin_response(u) for u in users]

    return UserAdminListResponse(
        total=total,
        skip=skip,
        limit=limit,
        items=items,
    )


@router.get("/{user_id}", response_model=UserAdminDetailResponse)
async def get_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_roles("admin")),
):
    """Get user detail with relations."""
    user = await UserService.get_user_admin_detail(db=db, user_id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    return _build_user_admin_detail_response(user)


@router.put("/{user_id}", response_model=UserAdminResponse)
async def update_user(
    user_id: uuid.UUID,
    payload: UserAdminUpdateRequest,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_roles("admin")),
):
    """Update user profile fields (non-sensitive only)."""
    user = await UserService.admin_update_user(
        db=db,
        user_id=user_id,
        data=payload,
        actor_id=admin_user.id,
    )

    return _build_user_admin_response(user)


@router.put("/{user_id}/status", response_model=UserStatusUpdateResponse)
async def change_user_status(
    user_id: uuid.UUID,
    payload: UserStatusUpdateRequest,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_roles("admin")),
):
    """Change user status with validation."""
    user = await UserService.change_user_status(
        db=db,
        user_id=user_id,
        new_status=payload.status,
        reason=payload.reason,
        actor_id=admin_user.id,
    )

    return UserStatusUpdateResponse(
        user_id=user.id,
        new_status=UserStatus(user.status),
    )


@router.delete("/{user_id}", response_model=UserDeleteResponse)
async def soft_delete_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_roles("admin")),
):
    """Soft-delete user (set status=blocked, do NOT remove record)."""
    await UserService.soft_delete_user(
        db=db,
        user_id=user_id,
        actor_id=admin_user.id,
    )

    return UserDeleteResponse(user_id=user_id)
