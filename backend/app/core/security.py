"""Security utilities: JWT tokens, authentication, and role-based access.

Provides:
- JWT token creation and validation
- OAuth2 Bearer scheme
- get_current_user dependency
- require_roles guard

Note: Service imports are lazy to avoid circular dependencies.
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User, UserStatus

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def create_token(
    subject: str,
    token_type: str,
    expires_delta: timedelta,
    extra_claims: dict | None = None,
) -> str:
    """Create a JWT token with standard claims."""
    expire = datetime.now(timezone.utc) + expires_delta
    payload = {
        "sub": subject,
        "type": token_type,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "jti": uuid.uuid4().hex,
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_access_token(subject: str, expires_delta: timedelta | None = None) -> str:
    """Create an access token (default TTL from settings)."""
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return create_token(
        subject=subject,
        token_type="access",
        expires_delta=expire - datetime.now(timezone.utc),
    )


def create_refresh_token(subject: str, expires_delta: timedelta | None = None) -> str:
    """Create a refresh token (default TTL from settings)."""
    return create_token(
        subject=subject,
        token_type="refresh",
        expires_delta=expires_delta
        or timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES),
    )


def create_password_reset_token(subject: str) -> str:
    """Create a password reset token."""
    return create_token(
        subject=subject,
        token_type="password_reset",
        expires_delta=timedelta(minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES),
    )


def create_otp_token(subject: str) -> str:
    """Create a short-lived OTP verification token."""
    return create_token(
        subject=subject,
        token_type="otp",
        expires_delta=timedelta(minutes=settings.OTP_TOKEN_EXPIRE_MINUTES),
    )


def decode_token(token: str, expected_type: str) -> dict:
    """Decode and validate a JWT token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Не удалось проверить учетные данные",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
    except JWTError as exc:
        raise credentials_exception from exc

    subject = payload.get("sub")
    token_type = payload.get("type")
    if not subject or token_type != expected_type:
        raise credentials_exception

    return payload


async def decode_and_validate_token(
    db: AsyncSession,
    token: str,
    expected_type: str,
) -> dict:
    """Decode token and check if it has been revoked."""
    payload = decode_token(token, expected_type=expected_type)
    jti = payload.get("jti")
    if jti:
        # Lazy import to avoid circular dependency
        from app.services.auth_service import AuthService

        if await AuthService.is_token_revoked(db, jti):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Токен отозван",
                headers={"WWW-Authenticate": "Bearer"},
            )
    return payload


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """FastAPI dependency: extract current user from JWT token."""
    payload = decode_token(token, expected_type="access")
    subject = payload["sub"]

    # Lazy import to avoid circular dependency
    from app.services.user_service import UserService

    user = await UserService.get_by_email(db, subject)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Не удалось проверить учетные данные",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.status in {UserStatus.suspended.value, UserStatus.blocked.value}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Пользователь недоступен",
        )

    if user.status == UserStatus.pending_otp.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Требуется завершение OTP верификации",
        )

    return user


def require_roles(*roles: str) -> Callable:
    """FastAPI dependency factory: require one of the specified roles."""
    async def _guard(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Недостаточно прав",
            )
        return current_user
    return _guard
