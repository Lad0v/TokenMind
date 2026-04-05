import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ip_claim import TokenRevocation


class AuthService:
    @staticmethod
    async def revoke_token(
        db: AsyncSession,
        jti: str,
        token_type: str,
        expires_at: datetime,
    ) -> None:
        db.add(TokenRevocation(jti=jti, token_type=token_type, expires_at=expires_at))
        await db.flush()

    @staticmethod
    async def is_token_revoked(db: AsyncSession, jti: str) -> bool:
        result = await db.execute(select(TokenRevocation).where(TokenRevocation.jti == jti))
        return result.scalar_one_or_none() is not None

    @staticmethod
    async def cleanup_expired_revocations(db: AsyncSession) -> None:
        now = datetime.now(timezone.utc)
        result = await db.execute(select(TokenRevocation).where(TokenRevocation.expires_at < now))
        for row in result.scalars().all():
            await db.delete(row)
        await db.flush()

    @staticmethod
    def make_tracking_jti() -> str:
        return uuid.uuid4().hex
