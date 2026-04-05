import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field

from app.models.ip_claim import IpClaimStatus, IpReviewDecision


class PatentPrecheckResponse(BaseModel):
    """Legacy precheck response for /ip/precheck endpoint."""
    status: str
    patent_number: str
    title: str | None = None
    owner: str | None = None
    metadata: dict | None = None
    source_id: str | None = None
    prechecked: bool
    message: str | None = None


class CreateIpClaimRequest(BaseModel):
    patent_number: str = Field(min_length=3, max_length=100)
    patent_title: Optional[str] = None
    claimed_owner_name: str = Field(min_length=2, max_length=255)
    description: Optional[str] = None
    jurisdiction: Optional[str] = "US"
    precheck_snapshot: Optional[dict[str, Any]] = None


class IpClaimResponse(BaseModel):
    id: uuid.UUID
    issuer_user_id: uuid.UUID
    patent_number: str
    patent_title: Optional[str]
    claimed_owner_name: str
    description: Optional[str]
    jurisdiction: Optional[str]
    status: IpClaimStatus
    prechecked: bool
    precheck_status: Optional[str]
    source_id: Optional[str]
    checked_at: Optional[datetime]
    patent_metadata: Optional[dict[str, Any]]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class IpClaimListResponse(BaseModel):
    total: int
    items: list[IpClaimResponse]


class IpClaimReviewRequest(BaseModel):
    decision: IpReviewDecision
    notes: Optional[str] = None


class UploadDocumentResponse(BaseModel):
    id: uuid.UUID
    ip_claim_id: uuid.UUID
    file_url: str
    doc_type: Optional[str]
    uploaded_at: datetime

    model_config = {"from_attributes": True}
