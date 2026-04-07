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

from app.models.user import Profile, User, UserStatus, UserRole, VerificationStatus
from app.schemas.user import ProfileUpdate

_ITERATIONS = 260_000
_HASH_ALG = "sha256"
_SOLANA_WALLET_RE = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{32,44}$")


def _is_valid_solana_wallet(value: str) -> bool:
    return bool(_SOLANA_WALLET_RE.fullmatch(value.strip()))


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

    @staticmethod
    async def get_by_wallet(
        db: AsyncSession,
        wallet_address: str,
        network: str = "solana-devnet",
    ) -> Optional[User]:
        from app.models.user import WalletLink

        stmt = (
            select(User)
            .join(WalletLink, WalletLink.user_id == User.id)
            .where(
                WalletLink.wallet_address == wallet_address.strip(),
                WalletLink.network == network.strip().lower(),
            )
            .options(joinedload(User.profile))
        )
        result = await db.execute(stmt)
        return result.scalars().unique().one_or_none()

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
        password: str,
        role: str,
        legal_name: str | None,
        country: str | None,
    ) -> User:
        user = User(
            email=email.lower().strip(),
            password_hash=cls.hash_password(password),
            role=role,
            status="active",
        )
        db.add(user)
        await db.flush()

        profile = Profile(
            user_id=user.id,
            full_name=legal_name,
            country=country,
        )
        db.add(profile)
        await db.flush()
        await db.refresh(user)
        return user

    @classmethod
    async def create_investor_user(
        cls,
        db: AsyncSession,
        email: str,
        wallet_address: str,
        role: str = "investor",
    ) -> User:
        """Create investor user with wallet only — no OTP flow needed."""
        from fastapi import HTTPException

        from app.models.user import WalletLink

        normalized_wallet = wallet_address.strip()
        normalized_network = "solana-devnet"

        if not _is_valid_solana_wallet(normalized_wallet):
            raise HTTPException(status_code=400, detail="Некорректный Solana wallet address")

        existing_wallet_stmt = select(WalletLink).where(
            WalletLink.wallet_address == normalized_wallet,
            WalletLink.network == normalized_network,
        )
        existing_wallet = (await db.execute(existing_wallet_stmt)).scalar_one_or_none()
        if existing_wallet:
            raise HTTPException(
                status_code=400,
                detail="Этот Solana-кошелек уже привязан к другому аккаунту. Войдите через Phantom или используйте другой wallet.",
            )

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
            wallet_address=normalized_wallet,
            network=normalized_network,
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
    async def list_wallet_links(db: AsyncSession, user_id: uuid.UUID) -> list["WalletLink"]:
        from app.models.user import WalletLink

        stmt = (
            select(WalletLink)
            .where(WalletLink.user_id == user_id)
            .order_by(WalletLink.is_primary.desc(), WalletLink.created_at.asc())
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def link_wallet(
        db: AsyncSession,
        user_id: uuid.UUID,
        wallet_address: str,
        network: str = "solana-devnet",
        is_primary: bool = True,
    ) -> "WalletLink":
        from fastapi import HTTPException

        from app.models.user import WalletLink

        normalized_wallet = wallet_address.strip()
        normalized_network = network.strip().lower()
        if not normalized_wallet:
            raise HTTPException(status_code=400, detail="wallet_address обязателен")
        if not _is_valid_solana_wallet(normalized_wallet):
            raise HTTPException(status_code=400, detail="Некорректный Solana wallet address")

        stmt = select(WalletLink).where(
            WalletLink.wallet_address == normalized_wallet,
            WalletLink.network == normalized_network,
        )
        result = await db.execute(stmt)
        existing_wallet = result.scalar_one_or_none()
        now = datetime.now(timezone.utc)

        if existing_wallet and existing_wallet.user_id != user_id:
            raise HTTPException(status_code=409, detail="Кошелек уже привязан к другому пользователю")

        if is_primary:
            current_wallets = await UserService.list_wallet_links(db, user_id)
            for current_wallet in current_wallets:
                if current_wallet.network == normalized_network and current_wallet.id != getattr(existing_wallet, "id", None):
                    current_wallet.is_primary = False
                    current_wallet.updated_at = now

        if existing_wallet:
            existing_wallet.is_primary = is_primary or existing_wallet.is_primary
            existing_wallet.updated_at = now
            await db.flush()
            await db.refresh(existing_wallet)
            return existing_wallet

        wallet_link = WalletLink(
            user_id=user_id,
            wallet_address=normalized_wallet,
            network=normalized_network,
            is_primary=is_primary,
        )
        db.add(wallet_link)
        await db.flush()
        await db.refresh(wallet_link)
        return wallet_link

    @staticmethod
    async def unlink_wallet(
        db: AsyncSession,
        user_id: uuid.UUID,
        wallet_id: uuid.UUID,
    ) -> None:
        from fastapi import HTTPException

        from app.models.user import WalletLink

        stmt = select(WalletLink).where(
            WalletLink.id == wallet_id,
            WalletLink.user_id == user_id,
        )
        result = await db.execute(stmt)
        wallet_link = result.scalar_one_or_none()
        if not wallet_link:
            raise HTTPException(status_code=404, detail="Кошелек не найден")

        network = wallet_link.network
        was_primary = wallet_link.is_primary
        await db.delete(wallet_link)
        await db.flush()

        if not was_primary:
            return

        replacement_stmt = (
            select(WalletLink)
            .where(WalletLink.user_id == user_id, WalletLink.network == network)
            .order_by(WalletLink.created_at.asc())
        )
        replacement_result = await db.execute(replacement_stmt)
        replacement = replacement_result.scalars().first()
        if replacement:
            replacement.is_primary = True
            replacement.updated_at = datetime.now(timezone.utc)
            await db.flush()

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
    ) -> "VerificationCase":
        """Create a new verification case with pending status."""
        from app.models.user import VerificationCase, VerificationStatus

        vc = VerificationCase(
            user_id=user_id,
            id_document_url=id_document_url,
            selfie_url=selfie_url,
            user_address=user_address,
            status=VerificationStatus.pending.value,
        )
        db.add(vc)
        await db.flush()
        await db.refresh(vc)
        return vc

    @staticmethod
    async def ensure_initial_verification_case(db: AsyncSession, user: User) -> None:
        """Create a starter verification case for issuer/user flows if one does not exist."""
        if user.role not in {
            UserRole.user.value,
            UserRole.issuer.value,
            UserRole.investor.value,
            UserRole.user,
            UserRole.issuer,
            UserRole.investor,
        }:
            return

        existing_case = await UserService.get_latest_verification_case(db, user.id)
        if existing_case:
            return

        from app.models.user import VerificationCase

        db.add(
            VerificationCase(
                user_id=user.id,
                status=VerificationStatus.not_started.value,
            )
        )
        await db.flush()

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

    @staticmethod
    async def list_verification_cases_admin(
        db: AsyncSession,
        skip: int = 0,
        limit: int = 50,
        status: Optional[VerificationStatus] = None,
        search: Optional[str] = None,
    ) -> tuple[list["VerificationCase"], int]:
        """List verification cases with related user/profile for admin queue."""
        from app.models.user import VerificationCase

        query = (
            select(VerificationCase)
            .options(joinedload(VerificationCase.user).joinedload(User.profile))
        )
        count_query = select(func.count()).select_from(VerificationCase)

        filters = []
        if status is not None:
            filters.append(VerificationCase.status == status)

        if search:
            search_term = f"%{search.lower().strip()}%"
            filters.append(
                or_(
                    User.email.ilike(search_term),
                    Profile.full_name.ilike(search_term),
                )
            )
            query = query.join(VerificationCase.user).outerjoin(User.profile)
            count_query = count_query.join(VerificationCase.user).outerjoin(User.profile)

        if filters:
            query = query.where(*filters)
            count_query = count_query.where(*filters)

        query = query.order_by(VerificationCase.created_at.desc()).offset(skip).limit(limit)
        total = (await db.execute(count_query)).scalar() or 0
        items = (await db.execute(query)).scalars().unique().all()
        return list(items), total

    @staticmethod
    async def get_verification_case_admin_detail(
        db: AsyncSession,
        case_id: uuid.UUID,
    ) -> Optional["VerificationCase"]:
        """Get one verification case with related user/profile."""
        from app.models.user import VerificationCase

        stmt = (
            select(VerificationCase)
            .where(VerificationCase.id == case_id)
            .options(joinedload(VerificationCase.user).joinedload(User.profile))
        )
        result = await db.execute(stmt)
        return result.scalars().unique().one_or_none()
