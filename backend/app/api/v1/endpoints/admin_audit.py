"""Admin audit log endpoints."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import require_roles
from app.models.user import User
from app.schemas.admin import (
    AuditLogActorRead,
    AuditLogAdminListResponse,
    AuditLogAdminResponse,
)
from app.services.audit_service import AuditService

router = APIRouter()


def _resolve_audit_category(log) -> str:
    action = log.action.lower()
    entity_type = log.entity_type.lower()

    if "verification" in entity_type or "kyc" in action:
        return "kyc"
    if entity_type in {"ip_claim", "patent", "patent_search"} or "ip_claim" in action:
        return "ip_review"
    if entity_type == "user" or action.startswith("auth."):
        return "user"
    return "system"


def _resolve_audit_severity(log) -> str:
    action = log.action.lower()
    payload = log.payload or {}

    if "failed" in action or "error" in action:
        return "error"
    if "reject" in action or "blocked" in action or "suspend" in action:
        return "warning"
    if payload.get("new_status") in {"blocked", "rejected", "suspended"}:
        return "warning"
    return "info"


def _build_audit_log_response(log) -> AuditLogAdminResponse:
    actor = getattr(log, "actor", None)
    return AuditLogAdminResponse(
        id=log.id,
        action=log.action,
        entity_type=log.entity_type,
        entity_id=log.entity_id,
        payload=log.payload,
        created_at=log.created_at,
        category=_resolve_audit_category(log),
        severity=_resolve_audit_severity(log),
        actor=AuditLogActorRead(id=actor.id, email=actor.email) if actor else None,
    )


@router.get("", response_model=AuditLogAdminListResponse)
async def list_audit_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    action: str | None = Query(None),
    entity_type: str | None = Query(None),
    search: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_roles("admin", "compliance_officer")),
):
    items, total = await AuditService.list_logs(
        db=db,
        skip=skip,
        limit=limit,
        action=action,
        entity_type=entity_type,
        search=search,
    )
    return AuditLogAdminListResponse(
        total=total,
        skip=skip,
        limit=limit,
        items=[_build_audit_log_response(item) for item in items],
    )
