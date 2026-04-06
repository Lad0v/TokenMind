import hashlib
import hmac
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.user import Profile, User, UserStatus, UserRole, WalletLink
from app.schemas.user import ProfileUpdate

_ITERATIONS = 260_000
_HASH_ALG = "sha256"

# Base58 alphabet (no 0, O, I, l)
_BASE58_PATTERN = re.compile(r'^[1-9A-HJ-NP-Za-km-z]+$')


def validate_wallet_address(wallet_address: str) -> bool:
    """Validate Solana wallet address format (base58, 32-44 chars)."""
    if not wallet_address:
        return False
    if len(wallet_address) < 32 or len(wallet_address) > 44:
        return False
    if not _BASE58_PATTERN.match(wallet_address):
        return False
    return True


class UserService:

    @staticmethod
    def hash_password(password: str) -> str:
        salt = os.urandom(16).hex()
        key = hashlib.pbkdf2_hmac(_HASH_ALG, password.encode(), salt.encode(), _ITERATIONS)
        return f"pbkdf2_{_HASH_ALG}${_ITERATIONS}${salt}${key.hex()}"

    @staticmethod
    def verify_password(plain: str, hashed: str) -> bool:
        try:
            _, iterations_str, salt, key_hex = hashed.split("$")
            iterations = int(iterations_str)
            new_key = hashlib.pbkdf2_hmac(
                _HASH_ALG, plain.encode(), salt.encode(), iterations
            )
            return hmac.compare_digest(new_key.hex(), key_hex)
        except Exception:
            return False

    @staticmethod
    async def get_by_id(db: AsyncSession, user_id: uuid.UUID) -> Optional[User]:
        result = await db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_email(db: AsyncSession, email: str) -> Optional[User]:
        result = await db.execute(select(User).where(User.email == email.lower().strip()))
        return result.scalar_one_or_none()

    @classmethod
    async def authenticate(cls, db: AsyncSession, email: str, password: str) -> Optional[User]:
        user = await cls.get_by_email(db, email)
        if not user or not user.password_hash:
            return None
        if not cls.verify_password(password, user.password_hash):
            return None
        return user

    @staticmethod
    async def get_all(db: AsyncSession, skip: int = 0, limit: int = 20):
        total_result = await db.execute(select(func.count()).select_from(User))
        total = total_result.scalar()

        result = await db.execute(select(User).offset(skip).limit(limit))
        users = result.scalars().all()

        return total, users

    @classmethod
    async def create_auth_user(
        cls,
        db: AsyncSession,
        email: str,
        wallet_address: str,
        role: str,
        legal_name: str | None,
        country: str | None,
    ) -> tuple[User, bool]:
        """Create user with email + wallet_address.

        All users are created as investors with status=active.
        Wallet is created as primary (immutable).

        Returns tuple of (user, is_new).
        """
        from app.models.user import UserStatus

        # Check if user already exists by wallet
        existing_wallet = await db.execute(
            select(WalletLink).where(
                WalletLink.wallet_address == wallet_address.strip(),
                WalletLink.network == "solana",
            )
        )
        existing_link = existing_wallet.scalar_one_or_none()

        if existing_link:
            # User exists — return existing
            user = await cls.get_by_id(db, existing_link.user_id)
            return user, False

        # Check if user exists by email
        existing_user = await cls.get_by_email(db, email)
        if existing_user:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="Email уже занят")

        # Create new user (investor, active)
        status = UserStatus.active.value

        user = User(
            email=email.lower().strip(),
            password_hash=None,  # No password — wallet auth only
            role=role,
            status=status,
        )
        db.add(user)
        await db.flush()

        if legal_name or country:
            profile = Profile(
                user_id=user.id,
                full_name=legal_name,
                country=country,
            )
            db.add(profile)

        # Create primary wallet link
        wallet = WalletLink(
            user_id=user.id,
            wallet_address=wallet_address.strip(),
            network="solana",
            is_primary=True,
        )
        db.add(wallet)

        await db.flush()
        await db.refresh(user)
        return user, True

    @classmethod
    async def create_investor_user(
        cls,
        db: AsyncSession,
        email: str,
        wallet_address: str,
        role: str = "investor",
    ) -> User:
        """Create investor user with wallet only — no OTP flow needed."""
        from app.models.user import WalletLink

        user = User(
            email=email.lower().strip(),
            password_hash=None,
            role=role,
            status="active",
        )
        db.add(user)
        await db.flush()

        wallet = WalletLink(
            user_id=user.id,
            wallet_address=wallet_address,
            network="default",
            is_primary=True,
        )
        db.add(wallet)
        await db.flush()
        await db.refresh(user)
        return user

    @classmethod
    async def activate_after_otp(cls, db: AsyncSession, user: User) -> User:
        user.status = "active"
        await db.flush()
        await db.refresh(user)
        return user

    @staticmethod
    async def delete(db: AsyncSession, user: User) -> None:
        await db.delete(user)
        await db.flush()

    @staticmethod
    async def get_profile(db: AsyncSession, user_id: uuid.UUID) -> Optional[Profile]:
        result = await db.execute(select(Profile).where(Profile.user_id == user_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def upsert_profile(db: AsyncSession, user_id: uuid.UUID, data: ProfileUpdate) -> Profile:
        profile = await UserService.get_profile(db, user_id)
        if not profile:
            profile = Profile(user_id=user_id)
            db.add(profile)

        if data.legal_name is not None:
            profile.full_name = data.legal_name
        if data.country is not None:
            profile.country = data.country

        profile.updated_at = datetime.now(timezone.utc)
        await db.flush()
        await db.refresh(profile)
        return profile

    @staticmethod
    async def set_status(db: AsyncSession, user: User, status_value: str) -> User:
        user.status = status_value
        await db.flush()
        await db.refresh(user)
        return user

    @staticmethod
    async def set_password(db: AsyncSession, user: User, new_password: str) -> User:
        user.password_hash = UserService.hash_password(new_password)
        await db.flush()
        await db.refresh(user)
        return user

    # -----------------------------------------------------------------------
    # Verification Case helpers
    # -----------------------------------------------------------------------

    @staticmethod
    async def get_latest_verification_case(
        db: AsyncSession, user_id: uuid.UUID
    ) -> Optional["VerificationCase"]:
        """Get the most recent verification case for a user."""
        from app.models.user import VerificationCase

        stmt = (
            select(VerificationCase)
            .where(VerificationCase.user_id == user_id)
            .order_by(VerificationCase.created_at.desc())
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def create_verification_case(
        db: AsyncSession,
        user_id: uuid.UUID,
        id_document_url: str,
        selfie_url: str,
        user_address: str,
        video_url: str | None = None,
    ) -> "VerificationCase":
        """Create a new verification case with pending status."""
        from app.models.user import VerificationCase, VerificationStatus

        vc = VerificationCase(
            user_id=user_id,
            id_document_url=id_document_url,
            selfie_url=selfie_url,
            user_address=user_address,
            video_url=video_url,
            status=VerificationStatus.pending.value,
        )
        db.add(vc)
        await db.flush()
        await db.refresh(vc)
        return vc

    @staticmethod
    async def review_verification_case(
        db: AsyncSession,
        case: "VerificationCase",
        reviewer_id: uuid.UUID,
        decision: str,
        notes: str | None = None,
    ) -> "VerificationCase":
        """Review a verification case and update user status accordingly."""
        from datetime import datetime, timezone

        from app.models.user import VerificationCase, VerificationStatus

        if decision == "approved":
            case.status = VerificationStatus.approved.value
            user = await UserService.get_by_id(db, case.user_id)
            if user:
                user.status = "active"
        elif decision == "rejected":
            case.status = VerificationStatus.rejected.value
            user = await UserService.get_by_id(db, case.user_id)
            if user:
                user.status = "rejected"
        else:
            from fastapi import HTTPException

            raise HTTPException(status_code=400, detail="Недопустимое решение")

        case.reviewer_notes = notes
        case.reviewed_by = reviewer_id
        case.reviewed_at = datetime.now(timezone.utc)
        await db.flush()
        await db.refresh(case)
        return case

    # -----------------------------------------------------------------------
    # Admin helpers
    # -----------------------------------------------------------------------

    @staticmethod
    async def list_users(
        db: AsyncSession,
        skip: int = 0,
        limit: int = 50,
        role: Optional[UserRole] = None,
        status: Optional[UserStatus] = None,
        search: Optional[str] = None,
    ) -> tuple[list[User], int]:
        """List users with filtering and pagination.

        Returns tuple of (users, total_count).
        """
        base_query = select(User).options(joinedload(User.profile))

        filters = []
        if role is not None:
            filters.append(User.role == role)
        if status is not None:
            filters.append(User.status == status)
        if search:
            search_term = f"%{search.lower().strip()}%"
            filters.append(
                or_(
                    User.email.ilike(search_term),
                    Profile.full_name.ilike(search_term),
                )
            )

        if filters:
            # Need to join profile for search
            if search:
                base_query = base_query.outerjoin(Profile)
            base_query = base_query.where(*filters)

        # Get total count
        count_query = select(func.count()).select_from(User)
        if filters:
            if search:
                count_query = count_query.outerjoin(Profile)
            count_query = count_query.where(*filters)

        total_result = await db.execute(count_query)
        total = total_result.scalar()

        # Get paginated results
        base_query = base_query.offset(skip).limit(limit)
        result = await db.execute(base_query)
        users = result.scalars().unique().all()

        return list(users), total

    @staticmethod
    async def get_user_admin_detail(
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> Optional[User]:
        """Get user with all relations for admin detail view."""
        from app.models.user import KYCCase, WalletLink, VerificationCase

        stmt = (
            select(User)
            .where(User.id == user_id)
            .options(
                joinedload(User.profile),
                joinedload(User.kyc_cases),
                joinedload(User.wallet_links),
                joinedload(User.verification_cases),
            )
        )
        result = await db.execute(stmt)
        return result.scalars().unique().one_or_none()

    @staticmethod
    async def admin_update_user(
        db: AsyncSession,
        user_id: uuid.UUID,
        data: "UserAdminUpdateRequest",
        actor_id: uuid.UUID,
    ) -> User:
        """Update user profile fields by admin.

        Only allows updating non-sensitive fields.
        Role changes are logged to audit.
        """
        from app.schemas.admin import UserAdminUpdateRequest

        user = await UserService.get_by_id(db, user_id)
        if not user:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Пользователь не найден")

        old_role = user.role

        # Update profile
        profile = await UserService.get_profile(db, user_id)
        if not profile:
            profile = Profile(user_id=user_id)
            db.add(profile)

        if data.full_name is not None:
            profile.full_name = data.full_name
        if data.country is not None:
            profile.country = data.country
        if data.organization_name is not None:
            profile.organization_name = data.organization_name
        if data.preferred_language is not None:
            profile.preferred_language = data.preferred_language
        if data.role is not None:
            user.role = data.role

        profile.updated_at = datetime.now(timezone.utc)
        await db.flush()
        await db.refresh(user)
        await db.refresh(profile)

        # Log role change if it happened
        if data.role is not None and old_role != data.role:
            from app.services.audit_service import AuditService
            await AuditService.write(
                db=db,
                action="user_role_change",
                entity_type="user",
                entity_id=str(user_id),
                actor_id=actor_id,
                payload={"old_role": old_role.value, "new_role": data.role.value},
            )

        return user

    @staticmethod
    async def change_user_status(
        db: AsyncSession,
        user_id: uuid.UUID,
        new_status: UserStatus,
        reason: str,
        actor_id: uuid.UUID,
    ) -> User:
        """Change user status with validation and audit logging.

        Allowed transitions:
        - active ↔ suspended
        - active → blocked
        - suspended → blocked
        """
        user = await UserService.get_by_id(db, user_id)
        if not user:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Пользователь не найден")

        old_status = UserStatus(user.status)

        # Validate transition
        allowed_transitions = {
            UserStatus.active: {UserStatus.suspended, UserStatus.blocked},
            UserStatus.suspended: {UserStatus.active, UserStatus.blocked},
            UserStatus.blocked: set(),  # blocked is terminal
            UserStatus.pending_otp: set(),
            UserStatus.rejected: set(),
        }

        if new_status not in allowed_transitions.get(old_status, set()):
            from fastapi import HTTPException
            raise HTTPException(
                status_code=400,
                detail=f"Недопустимый переход статуса: {old_status.value} → {new_status.value}",
            )

        user.status = new_status.value
        await db.flush()
        await db.refresh(user)

        # Audit log
        from app.services.audit_service import AuditService
        await AuditService.write(
            db=db,
            action="user_status_change",
            entity_type="user",
            entity_id=str(user_id),
            actor_id=actor_id,
            payload={
                "old_status": old_status.value,
                "new_status": new_status.value,
                "reason": reason,
            },
        )

        return user

    @staticmethod
    async def soft_delete_user(
        db: AsyncSession,
        user_id: uuid.UUID,
        actor_id: uuid.UUID,
    ) -> User:
        """Soft-delete user by setting status to blocked.

        Does NOT remove DB record.
        Raises 403 if target user is admin.
        """
        user = await UserService.get_by_id(db, user_id)
        if not user:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Пользователь не найден")

        if user.role == UserRole.admin:
            from fastapi import HTTPException
            raise HTTPException(
                status_code=403,
                detail="Невозможно удалить администратора",
            )

        old_status = user.status
        user.status = UserStatus.blocked.value
        await db.flush()
        await db.refresh(user)

        # Audit log
        from app.services.audit_service import AuditService
        await AuditService.write(
            db=db,
            action="user_soft_delete",
            entity_type="user",
            entity_id=str(user_id),
            actor_id=actor_id,
            payload={
                "old_status": old_status,
                "new_status": UserStatus.blocked.value,
            },
        )

        return user

    # =========================================================================
    # Wallet Link Management
    # =========================================================================

    @staticmethod
    async def create_wallet_link(
        db: AsyncSession,
        user_id: uuid.UUID,
        wallet_address: str,
        network: str = "solana",
        is_primary: bool = False,
    ) -> WalletLink:
        """Add a wallet address to user's account.

        Blocks setting is_primary=True if user already has a primary wallet.
        """
        from fastapi import HTTPException

        # Check if user already has a primary wallet for this network
        if is_primary:
            existing_primaries = await db.execute(
                select(WalletLink).where(
                    WalletLink.user_id == user_id,
                    WalletLink.network == network.lower(),
                    WalletLink.is_primary == True,
                )
            )
            if existing_primaries.scalars().first():
                raise HTTPException(
                    status_code=400,
                    detail="User already has a primary wallet for this network",
                )

        wallet = WalletLink(
            user_id=user_id,
            wallet_address=wallet_address.strip(),
            network=network.lower(),
            is_primary=is_primary,
        )
        db.add(wallet)
        await db.flush()
        await db.refresh(wallet)
        return wallet

    @staticmethod
    async def get_user_wallets(db: AsyncSession, user_id: uuid.UUID) -> list[WalletLink]:
        """Get all wallet addresses for a user."""
        result = await db.execute(
            select(WalletLink)
            .where(WalletLink.user_id == user_id)
            .order_by(WalletLink.is_primary.desc(), WalletLink.created_at)
        )
        return list(result.scalars().all())

    @staticmethod
    async def get_primary_wallet(
        db: AsyncSession, 
        user_id: uuid.UUID,
        network: str = "solana",
    ) -> Optional[WalletLink]:
        """Get primary wallet for a specific network."""
        result = await db.execute(
            select(WalletLink).where(
                WalletLink.user_id == user_id,
                WalletLink.network == network,
                WalletLink.is_primary == True,
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def delete_wallet(
        db: AsyncSession,
        user_id: uuid.UUID,
        wallet_id: uuid.UUID,
    ) -> bool:
        """Remove a wallet link. Raises 403 if wallet is primary."""
        from fastapi import HTTPException

        result = await db.execute(
            select(WalletLink).where(
                WalletLink.id == wallet_id,
                WalletLink.user_id == user_id,
            )
        )
        wallet = result.scalar_one_or_none()
        if not wallet:
            return False

        # IM MUTABILITY GUARD: Primary wallet cannot be removed
        if wallet.is_primary:
            raise HTTPException(
                status_code=403,
                detail="Primary wallet cannot be removed",
            )

        await db.delete(wallet)
        return True

    # =========================================================================
    # Wallet-only registration
    # =========================================================================

    @staticmethod
    async def register_or_login_by_wallet(
        db: AsyncSession,
        wallet_address: str,
        network: str = "solana",
    ) -> tuple[User, bool]:  # (user, is_new)
        """Register new investor by wallet or return existing user.

        Returns tuple of (user, is_new_user).
        """
        from fastapi import HTTPException

        # Normalize wallet address
        wallet_address = wallet_address.strip()

        # 1. Look up existing WalletLink
        existing = await db.execute(
            select(WalletLink).where(
                WalletLink.wallet_address == wallet_address,
                WalletLink.network == network.lower(),
            )
        )
        wallet_link = existing.scalar_one_or_none()

        if wallet_link:
            # Wallet exists — return existing user (login flow)
            user = await db.get(User, wallet_link.user_id)
            if not user:
                raise HTTPException(status_code=404, detail="User not found for wallet")
            return user, False

        # 2. Create new user (investor, active, no email/password)
        user = User(
            role=UserRole.investor.value,
            status=UserStatus.active.value,
            email=None,
            password_hash=None,
        )
        db.add(user)
        await db.flush()

        # 3. Create wallet link (primary, immutable)
        link = WalletLink(
            user_id=user.id,
            wallet_address=wallet_address,
            network=network.lower(),
            is_primary=True,
        )
        db.add(link)
        await db.commit()
        await db.refresh(user)

        return user, True
