"""Patent precheck endpoints.

Thin controllers that delegate to services.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.ip_claim import CreateIpClaimRequest, IpClaimResponse
from app.services.ip_claim_service import IpClaimService
from app.services.patent_service import PatentService

router = APIRouter()


class IpCheckResponse(BaseModel):
    status: str


class PatentPrecheckResponse(BaseModel):
    status: str
    patent_number: str
    title: str | None = None
    owner: str | None = None
    metadata: dict | None = None
    source_id: str | None = None
    prechecked: bool
    message: str | None = None


@router.post("/check", response_model=IpCheckResponse, status_code=201)
async def create_ip_check(
    payload: CreateIpClaimRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check if patent already exists for user; if not, create IP claim."""
    from sqlalchemy import select
    from app.models.patent import Patent

    stmt = select(Patent).where(
        Patent.patent_number == payload.patent_number,
        Patent.owner_user_id == current_user.id,
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        return IpCheckResponse(status="exists")

    try:
        await IpClaimService.create(db, current_user.id, payload)
        await db.commit()
        return IpCheckResponse(status="created")
    except Exception:
        return IpCheckResponse(status="pending")


@router.post("/precheck", response_model=PatentPrecheckResponse)
async def patent_precheck(
    payload: dict,
    current_user: User = Depends(get_current_user),
):
    """Quick patent precheck (no claim created)."""
    try:
        result = await PatentService.precheck(
            patent_number=payload.get("patent_number", ""),
            jurisdiction=payload.get("jurisdiction"),
            claimed_owner_name=payload.get("claimed_owner_name"),
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Precheck failed: {e}")
