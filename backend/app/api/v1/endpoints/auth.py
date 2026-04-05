"""Authentication endpoints.

Provides registration, login, OTP (legacy DB-based + Redis-based),
token refresh, logout, password reset, and current user retrieval.

OTP architecture:
- New endpoints (/otp-send, /otp-verify) use Redis-based OTP with HMAC-SHA256
- Legacy endpoints (/otp/send, /otp/verify) use SQLAlchemy-based OTP in DB
- Both coexist during migration; legacy will be removed after frontend migration
"""

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
from app.models.user import User, UserRole, UserStatus, VerificationStatus, VerificationCase
from app.schemas.auth import (
    AuthMeResponse,
    GenericSuccessResponse,
    LoginRequest,
    LoginResponse,
    OtpResendRequest,
    OtpSendRequest,
    OtpVerifyRequest,
    OTPSendRequest,
    OTPSendResponse,
    OTPVerifyRequest,
    OTPVerifyResponse,
    PasswordResetRequest,
    PasswordResetResponse,
    RegisterRequest,
    RegisterResponse,
)
from app.services.audit_service import AuditService
from app.services.otp_service import OTPService, generate_and_send_otp, verify_otp as verify_otp_redis
from app.services.otp_sender import resend_sms_otp
from app.services.user_service import UserService

router = APIRouter()


# ============================================================================
# Registration
# ============================================================================

@router.post("/register", response_model=RegisterResponse, status_code=201)
async def register_user(
    payload: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    if payload.role not in {UserRole.user, UserRole.issuer, UserRole.investor}:
        raise HTTPException(status_code=400, detail="Недопустимая роль")

    existing = await UserService.get_by_email(db, payload.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email уже занят")

    if payload.role == UserRole.investor:
        if not payload.wallet_address:
            raise HTTPException(status_code=400, detail="Для инвестора требуется wallet_address")
        if not payload.password:
            raise HTTPException(status_code=400, detail="Для инвестора требуется пароль")

        user = await UserService.create_investor_user(
            db,
            email=payload.email,
            wallet_address=payload.wallet_address,
        )
        await UserService.set_password(db, user, payload.password)

        await AuditService.write(
            db,
            action="auth.register_investor",
            entity_type="user",
            entity_id=str(user.id),
            actor_id=user.id,
        )
        return RegisterResponse(message="Investor registered successfully", user_id=str(user.id))

    # Patient / issuer: OTP registration flow
    user = await UserService.create_auth_user(
        db,
        email=payload.email,
        password=payload.password,
        role=payload.role,
        legal_name=payload.legal_name,
        country=payload.country,
    )

    otp_code = await OTPService.create_otp(db, user, purpose="registration")
    # TODO: Replace with real delivery (email/SMS)
    print(f"[DEV] OTP for {user.email}: {otp_code}")

    await AuditService.write(
        db,
        action="auth.register_patient",
        entity_type="user",
        entity_id=str(user.id),
        actor_id=user.id,
    )

    return RegisterResponse(
        message="OTP sent. Verify to complete registration.",
        user_id=str(user.id),
    )


# ============================================================================
# Redis-based OTP endpoints (new architecture)
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
):
    """Verify OTP and return short-lived verified_token (JWT, 10 min)."""
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

    verified_token = create_access_token(
        subject=payload.identifier,
        expires_delta=timedelta(minutes=10),
    )
    return {"verified": True, "verified_token": verified_token}


@router.post("/otp-resend", response_model=GenericSuccessResponse)
async def otp_resend(
    body: OtpResendRequest,
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
):
    """Resend OTP via SMS with rate limiting (max 3 per identifier per 10 minutes)."""
    rate_key = f"otp_resend_rate:{body.identifier}"
    resend_count = await redis.get(rate_key)
    if resend_count and int(resend_count) >= 3:
        raise HTTPException(
            status_code=429,
            detail={
                "code": "RESEND_RATE_LIMITED",
                "message": "Too many resend attempts. Try again later.",
            },
        )

    key = f"otp:{body.purpose}:{body.identifier}"
    if not await redis.exists(key):
        raise HTTPException(
            status_code=404,
            detail={"code": "OTP_NOT_FOUND", "message": "No active OTP for this identifier."},
        )

    await resend_sms_otp(body.identifier, via=body.via)

    pipe = redis.pipeline()
    pipe.incr(rate_key)
    pipe.expire(rate_key, 600)
    await pipe.execute()

    return GenericSuccessResponse(message="OTP resent successfully")


# ============================================================================
# Legacy SQLAlchemy-based OTP endpoints (to be removed after migration)
# ============================================================================

@router.post("/otp/send", response_model=OTPSendResponse, deprecated=True)
async def send_otp_legacy(
    payload: dict,
    db: AsyncSession = Depends(get_db),
):
    """[LEGACY] Send OTP via DB storage. Use /otp-send instead.
    
    Accepts: {"email": "..."} or {"identifier": "...", "purpose": "..."}
    """
    # Support both old {"email": ...} and new {"identifier": ..., "purpose": ...} formats
    email = payload.get("email") or payload.get("identifier")
    if not email:
        raise HTTPException(status_code=400, detail="email or identifier required")

    user = await UserService.get_by_email(db, email)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    if user.status == UserStatus.active.value:
        raise HTTPException(status_code=400, detail="Пользователь уже активирован")

    purpose = payload.get("purpose", "registration")
    otp_code = await OTPService.create_otp(db, user, purpose=purpose)
    # TODO: Replace with real delivery
    print(f"[DEV][LEGACY] OTP for {user.email}: {otp_code}")

    return OTPSendResponse(message="OTP code sent")


@router.post("/otp/verify", response_model=OTPVerifyResponse, deprecated=True)
async def verify_otp_legacy(
    payload: OTPVerifyRequest,
    db: AsyncSession = Depends(get_db),
):
    """[LEGACY] Verify OTP from DB storage. Use /otp-verify instead."""
    user = await UserService.get_by_email(db, payload.email)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    is_valid = await OTPService.verify_otp(db, user, payload.code)
    if not is_valid:
        raise HTTPException(status_code=400, detail="Неверный или просроченный OTP код")

    await UserService.activate_after_otp(db, user)

    if user.role in {UserRole.user, UserRole.issuer}:
        vc = VerificationCase(
            user_id=user.id,
            status=VerificationStatus.not_started,
        )
        db.add(vc)
        await db.flush()

    access_token = create_access_token(subject=user.email)
    refresh_token = create_refresh_token(subject=user.email)

    return OTPVerifyResponse(
        verified=True,
        message="OTP verified. Access granted.",
        access_token=access_token,
        refresh_token=refresh_token,
    )


# ============================================================================
# Login / Logout / Token Management
# ============================================================================

@router.post("/login", response_model=LoginResponse)
async def login_for_access_token(
    payload: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    user = await UserService.get_by_email(db, payload.email)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    if not user.password_hash or not UserService.verify_password(payload.password, user.password_hash):
        await AuditService.write(
            db,
            action="auth.login_failed",
            entity_type="user",
            payload={"email": payload.email},
        )
        raise HTTPException(status_code=401, detail="Неверный email или пароль")

    if user.status in {UserStatus.suspended.value, UserStatus.blocked.value}:
        raise HTTPException(status_code=403, detail="Пользователь недоступен")

    if user.status == UserStatus.pending_otp.value:
        raise HTTPException(status_code=403, detail="Требуется завершение OTP верификации")

    await AuditService.write(
        db,
        action="auth.login_success",
        entity_type="user",
        entity_id=str(user.id),
        actor_id=user.id,
    )

    return LoginResponse(
        role=user.role,
        access_token=create_access_token(subject=user.email),
        refresh_token=create_refresh_token(subject=user.email),
    )


@router.post("/refresh", response_model=LoginResponse)
async def refresh_access_token(
    payload: dict,
    db: AsyncSession = Depends(get_db),
):
    refresh_token = payload.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=400, detail="refresh_token required")

    token_payload = await decode_and_validate_token(db, refresh_token, expected_type="refresh")
    user = await UserService.get_by_email(db, token_payload["sub"])
    if not user:
        raise HTTPException(status_code=401, detail="Не удалось проверить учетные данные")

    if user.status in {UserStatus.suspended.value, UserStatus.blocked.value}:
        raise HTTPException(status_code=403, detail="Пользователь недоступен")

    return LoginResponse(
        role=user.role,
        access_token=create_access_token(subject=user.email),
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
    if current_user.role in {UserRole.user, UserRole.issuer}:
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
        email=current_user.email,
        name=name,
        role=current_user.role,
        status=current_user.status,
        verification_status=verification_status,
    )
