"""Authentication endpoints.

Provides:
- Registration (email + wallet_address, investor role only)
- Wallet login (POST /auth/login/wallet)
- OTP (Redis-based, generic)
- Patent submission OTP flow (email + phone)
- Logout, password reset, current user
"""

import uuid
from datetime import timedelta

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db, get_redis
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_and_validate_token,
    get_current_user,
)
from app.core.config import settings
from app.models.user import User, UserRole, UserStatus, VerificationStatus, VerificationCase
from app.schemas.auth import (
    AuthMeResponse,
    GenericSuccessResponse,
    LoginResponse,
    LoginWithTokenResponse,
    OtpSendRequest,
    OtpVerifyRequest,
    PasswordResetRequest,
    PasswordResetResponse,
    PatentOtpVerifyRequest,
    PatentOtpVerifyResponse,
    PatentSubmissionRequest,
    PatentSubmissionResponse,
    RegisterRequest,
    RegisterResponse,
    WalletLoginRequest,
    WalletLoginResponse,
)
from app.services.audit_service import AuditService
from app.services.otp_service import generate_and_send_otp, verify_otp as verify_otp_redis
from app.services.user_service import UserService, validate_wallet_address

router = APIRouter()


# ============================================================================
# Registration (email + wallet, investor only)
# ============================================================================

@router.post("/register", response_model=RegisterResponse, status_code=201)
async def register_user(
    payload: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    """Register investor with email + Solana wallet.

    - solana_wallet_address is required and becomes the primary (immutable) wallet
    - role is always 'investor'
    - user is active immediately
    - Upgrade to 'issuer' happens only after patent submission + OTP verification
    """
    # Validate wallet format
    if not validate_wallet_address(payload.solana_wallet_address):
        raise HTTPException(
            status_code=400,
            detail="Invalid wallet address format. Must be base58 encoded, 32-44 characters.",
        )

    # Check if user already exists by wallet
    from app.models.user import WalletLink
    from sqlalchemy import select

    existing_wallet = await db.execute(
        select(WalletLink).where(
            WalletLink.wallet_address == payload.solana_wallet_address.strip(),
            WalletLink.network == "solana",
        )
    )
    if existing_wallet.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Кошелек уже зарегистрирован")

    existing_email = await UserService.get_by_email(db, payload.email)
    if existing_email:
        raise HTTPException(status_code=400, detail="Email уже занят")

    user, _ = await UserService.create_auth_user(
        db,
        email=payload.email,
        wallet_address=payload.solana_wallet_address,
        role=payload.role,
        legal_name=payload.legal_name,
        country=payload.country,
    )

    await AuditService.write(
        db,
        action="auth.register_investor",
        entity_type="user",
        entity_id=str(user.id),
        actor_id=user.id,
    )

    return RegisterResponse(
        message="Investor registered successfully. Login with wallet to get tokens.",
    )


# ============================================================================
# Wallet Login (the ONLY way to login)
# ============================================================================

@router.post("/login/wallet", response_model=WalletLoginResponse)
async def login_wallet(
    body: WalletLoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """Login or register via Solana wallet address.

    If wallet exists → login (return tokens).
    If wallet is new → error (must register first via /register).
    """
    # Validate wallet address format
    if not validate_wallet_address(body.wallet_address):
        raise HTTPException(
            status_code=400,
            detail="Invalid wallet address format. Must be base58 encoded, 32-44 characters.",
        )

    # Find user by wallet
    from app.models.user import WalletLink
    from sqlalchemy import select

    result = await db.execute(
        select(WalletLink).where(
            WalletLink.wallet_address == body.wallet_address.strip(),
            WalletLink.network == body.network.lower(),
        )
    )
    wallet_link = result.scalar_one_or_none()

    if not wallet_link:
        raise HTTPException(
            status_code=404,
            detail="Wallet not found. Please register first via POST /api/v1/auth/register",
        )

    user = await UserService.get_by_id(db, wallet_link.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.status in {UserStatus.suspended.value, UserStatus.blocked.value}:
        raise HTTPException(status_code=403, detail="Account unavailable")

    # Create JWT tokens (sub = user.id)
    access_token = create_access_token(
        subject=str(user.id),
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    refresh_token = create_refresh_token(
        subject=str(user.id),
        expires_delta=timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES),
    )

    await AuditService.write(
        db,
        action="auth.wallet_login",
        entity_type="user",
        entity_id=str(user.id),
        actor_id=user.id,
    )

    return WalletLoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        role=user.role.value if isinstance(user.role, UserRole) else user.role,
        is_new_user=False,
    )


# ============================================================================
# Patent Submission OTP Flow
# ============================================================================

@router.post("/submit-patent", response_model=PatentSubmissionResponse)
async def submit_patent(
    payload: PatentSubmissionRequest,
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
    current_user: User = Depends(get_current_user),
):
    """Initial patent submission — requires email + phone for OTP.

    This endpoint:
    1. Validates the current user is an investor
    2. Stores patent submission data (pending OTP verification)
    3. Sends OTP to email AND phone
    4. Returns message telling frontend where OTP was sent
    5. Returns submission_id for later OTP verification

    After OTP verification, user role is upgraded from investor → issuer.
    """
    from app.models.user import WalletLink
    from app.models.ip_claim import IpClaim
    from sqlalchemy import select

    # Verify user is investor
    user_role = current_user.role.value if isinstance(current_user.role, UserRole) else current_user.role
    if user_role != UserRole.investor.value:
        raise HTTPException(
            status_code=400,
            detail="Only investors can submit patents",
        )

    # Check if user already has a primary wallet
    wallet_result = await db.execute(
        select(WalletLink).where(
            WalletLink.user_id == current_user.id,
            WalletLink.is_primary == True,
        )
    )
    primary_wallet = wallet_result.scalar_one_or_none()
    if not primary_wallet:
        raise HTTPException(status_code=400, detail="Primary wallet required")

    # Create IpClaim in 'pending_otp' status
    claim = IpClaim(
        issuer_user_id=current_user.id,
        patent_number=payload.patent_number,
        patent_title=payload.patent_title,
        claimed_owner_name=payload.claimed_owner_name,
        description=payload.description,
        jurisdiction=payload.jurisdiction,
        status="submitted",
        prechecked=False,
        patent_metadata={
            "submission_email": payload.email,
            "submission_phone": payload.phone,
            "wallet_address": primary_wallet.wallet_address,
        },
    )
    db.add(claim)
    await db.flush()

    # Send OTP to email
    try:
        await generate_and_send_otp(redis, payload.email, "patent_submission")
    except (HTTPException, RuntimeError) as exc:
        import logging
        logging.getLogger(__name__).warning(
            "OTP email delivery failed for %s: %s", payload.email, str(exc)
        )

    # Send OTP to phone (if SMS enabled)
    import app.services.otp_service as otp_module
    if otp_module.settings.ENABLE_SMS_OTP:
        try:
            from app.services.otp_sender import send_sms_otp
            import secrets
            code = f"{secrets.randbelow(900000) + 100000:06d}"
            await send_sms_otp(payload.phone, code)
            # Also store phone OTP in Redis
            await generate_and_send_otp(redis, payload.phone, "patent_submission_phone")
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning(
                "OTP SMS delivery failed for %s: %s", payload.phone, str(exc)
            )

    # Mask the email for response
    masked_email = payload.email[0] + "***@" + payload.email.split("@")[1]

    await AuditService.write(
        db,
        action="patent.submission_otp_sent",
        entity_type="ip_claim",
        entity_id=str(claim.id),
        actor_id=current_user.id,
        payload={"email": payload.email, "phone": payload.phone},
    )

    return PatentSubmissionResponse(
        message="OTP sent. Please verify to complete patent submission and upgrade to issuer role.",
        otp_sent_to=masked_email,
        otp_purpose="patent_submission",
        submission_id=str(claim.id),
    )


@router.post("/submit-patent/verify-otp", response_model=PatentOtpVerifyResponse)
async def verify_patent_submission_otp(
    payload: PatentOtpVerifyRequest,
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
    current_user: User = Depends(get_current_user),
):
    """Verify OTP for patent submission.

    After successful verification:
    1. User role is upgraded from investor → issuer
    2. IpClaim status is updated to 'prechecked'
    3. JWT tokens are returned
    """
    from app.models.ip_claim import IpClaim
    from sqlalchemy import select

    # Verify OTP
    try:
        await verify_otp_redis(redis, payload.email, payload.code, "patent_submission")
    except ValueError as exc:
        error_msg = str(exc)
        status_map = {
            "OTP_EXPIRED": 404,
            "OTP_NOT_FOUND": 404,
            "OTP_BLOCKED": 409,
            "OTP_INVALID": 422,
        }
        raise HTTPException(
            status_code=status_map.get(error_msg, 400),
            detail={"code": error_msg},
        )

    # Find the IpClaim
    claim_id = uuid.UUID(payload.submission_id)
    stmt = select(IpClaim).where(IpClaim.id == claim_id)
    result = await db.execute(stmt)
    claim = result.scalar_one_or_none()

    if not claim:
        raise HTTPException(status_code=404, detail="Patent submission not found")

    if claim.issuer_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your submission")

    # Upgrade user role: investor → issuer
    old_role = current_user.role.value if isinstance(current_user.role, UserRole) else current_user.role
    current_user.role = UserRole.issuer.value
    await db.flush()

    # Update claim status
    claim.status = "prechecked"
    await db.flush()

    # Create tokens
    access_token = create_access_token(
        subject=str(current_user.id),
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    refresh_token = create_refresh_token(
        subject=str(current_user.id),
        expires_delta=timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES),
    )

    await AuditService.write(
        db,
        action="user_role_upgraded_to_issuer",
        entity_type="user",
        entity_id=str(current_user.id),
        actor_id=current_user.id,
        payload={
            "old_role": old_role,
            "new_role": UserRole.issuer.value,
            "claim_id": str(claim.id),
        },
    )

    return PatentOtpVerifyResponse(
        verified=True,
        role_upgraded=True,
        new_role=UserRole.issuer.value,
        access_token=access_token,
        refresh_token=refresh_token,
    )


# ============================================================================
# Generic OTP endpoints (Redis-based)
# ============================================================================

@router.post("/otp-send")
async def otp_send(
    payload: OtpSendRequest,
    redis: aioredis.Redis = Depends(get_redis),
):
    """Generate and send OTP via email or SMS (Redis-based, HMAC-hashed codes)."""
    try:
        await generate_and_send_otp(redis, payload.identifier, payload.purpose)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"code": str(exc)})
    except HTTPException:
        raise
    return {"success": True}


@router.post("/otp-verify")
async def otp_verify(
    payload: OtpVerifyRequest,
    redis: aioredis.Redis = Depends(get_redis),
    db: AsyncSession = Depends(get_db),
):
    """Verify OTP and return short-lived verified_token (JWT, 10 min).

    For purpose='issuer_upgrade', also changes user role from investor to issuer.
    """
    try:
        await verify_otp_redis(redis, payload.identifier, payload.code, payload.purpose)
    except ValueError as exc:
        error_msg = str(exc)
        status_map = {
            "OTP_EXPIRED": 404,
            "OTP_NOT_FOUND": 404,
            "OTP_BLOCKED": 409,
            "OTP_INVALID": 422,
        }
        raise HTTPException(
            status_code=status_map.get(error_msg, 400),
            detail={"code": error_msg},
        )

    # Check if this is an issuer upgrade
    is_issuer_upgrade = payload.purpose == "issuer_upgrade"
    role_changed = False

    if is_issuer_upgrade:
        user = await UserService.get_by_email(db, payload.identifier)
        if user and user.role == UserRole.investor.value:
            old_role = user.role
            user.role = UserRole.issuer.value
            await db.flush()
            role_changed = True

            await AuditService.write(
                db,
                action="user_role_upgraded_to_issuer",
                entity_type="user",
                entity_id=str(user.id),
                actor_id=user.id,
                payload={"old_role": old_role, "new_role": UserRole.issuer.value},
            )

    verified_token = create_access_token(
        subject=payload.identifier if not is_issuer_upgrade else str(user.id),
        expires_delta=timedelta(minutes=10),
    )

    response = {"verified": True, "verified_token": verified_token}
    if role_changed:
        response["role_changed"] = True
        response["new_role"] = "issuer"

    return response


# ============================================================================
# Token Management / Logout / Password Reset / Me
# ============================================================================

@router.post("/refresh", response_model=LoginWithTokenResponse)
async def refresh_access_token(
    payload: dict,
    db: AsyncSession = Depends(get_db),
):
    """Refresh access token and return new tokens.

    Supports both user.id (UUID) and email formats in refresh token sub.
    """
    refresh_token = payload.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=400, detail="refresh_token required")

    token_payload = await decode_and_validate_token(db, refresh_token, expected_type="refresh")

    # sub is user.id (UUID) or email (legacy)
    user_id = token_payload.get("sub")
    user = None

    # Try UUID first
    try:
        user = await UserService.get_by_id(db, uuid.UUID(user_id))
    except (ValueError, AttributeError):
        # Fallback to email
        user = await UserService.get_by_email(db, user_id)

    if not user:
        raise HTTPException(status_code=401, detail="Не удалось проверить учетные данные")

    if user.status in {UserStatus.suspended.value, UserStatus.blocked.value}:
        raise HTTPException(status_code=403, detail="Пользователь недоступен")

    return LoginWithTokenResponse(
        role=user.role,
        access_token=create_access_token(subject=str(user.id)),
        refresh_token=refresh_token,
    )


@router.delete("/logout", response_model=GenericSuccessResponse)
async def logout(
    payload: dict,
    db: AsyncSession = Depends(get_db),
):
    refresh_token = payload.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=400, detail="refresh_token required")

    from app.services.auth_service import AuthService
    from datetime import datetime, timezone

    token_payload = await decode_and_validate_token(db, refresh_token, expected_type="refresh")
    jti = token_payload.get("jti")
    exp = token_payload.get("exp")
    if jti and exp:
        expires_at = datetime.fromtimestamp(exp, tz=timezone.utc) if isinstance(exp, (int, float)) else exp
        await AuthService.revoke_token(
            db,
            jti=jti,
            token_type="refresh",
            expires_at=expires_at,
        )

    return GenericSuccessResponse(message="Сессия завершена")


@router.put("/password-reset", response_model=PasswordResetResponse)
async def password_reset(
    payload: PasswordResetRequest,
    db: AsyncSession = Depends(get_db),
):
    user = await UserService.get_by_email(db, payload.email)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    await UserService.set_password(db, user, payload.new_password)
    await AuditService.write(
        db,
        action="auth.password_reset",
        entity_type="user",
        entity_id=str(user.id),
        actor_id=user.id,
    )

    return PasswordResetResponse(message="Пароль обновлен")


@router.get("/me", response_model=AuthMeResponse)
async def read_current_user(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    profile = await UserService.get_profile(db, current_user.id)
    name = profile.full_name if profile else None

    verification_status = None
    if current_user.role in {UserRole.investor.value, UserRole.issuer.value}:
        from app.models.user import VerificationCase
        from sqlalchemy import select

        stmt = (
            select(VerificationCase)
            .where(VerificationCase.user_id == current_user.id)
            .order_by(VerificationCase.created_at.desc())
        )
        result = await db.execute(stmt)
        vc = result.scalar_one_or_none()
        if vc:
            verification_status = vc.status

    return AuthMeResponse(
        id=str(current_user.id),
        email=current_user.email,  # May be None for wallet-only users
        name=name,
        role=current_user.role,
        status=current_user.status,
        verification_status=verification_status,
    )
