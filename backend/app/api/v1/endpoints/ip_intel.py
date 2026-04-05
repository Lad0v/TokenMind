"""
REST endpoints для модуля IP Intelligence (ip_intel).

Endpoints:
- POST /api/patents/precheck/international - проверка патента
- POST /api/patents/search/international - международный поиск
- POST /api/ip-claims/{id}/enrich/international - обогащение IP claim
"""

import logging
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.ip_intel import (
    PatentPrecheckRequest,
    PatentPrecheckResponse,
    PatentSearchRequest,
    PatentSearchResponse,
    IpClaimEnrichRequest,
    IpClaimEnrichResponse,
)
from app.services.ip_intel_service import (
    PatentStatusCheckService,
    PatentDataEnrichmentService,
    InternationalSearchService,
)
from app.services.audit_service import AuditService

logger = logging.getLogger(__name__)

router = APIRouter()


# =============================================================================
# Patent Precheck Endpoint
# =============================================================================

@router.post("/precheck/international", response_model=PatentPrecheckResponse)
async def patent_precheck_international(
    payload: PatentPrecheckRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Проверка существования и статуса патента в международных реестрах.
    
    Маршрутизирует запрос по country_code к соответствующему источнику:
    - US -> USPTO + PatentsView (опционально)
    - EP -> EPO OPS
    - WO -> WIPO PATENTSCOPE
    
    Возвращает нормализованную запись патента и рекомендацию по токенизации.
    
    **Требуется авторизация.**
    """
    service = PatentStatusCheckService(db)
    
    try:
        response = await service.check_patent(
            patent_number=payload.patent_number,
            country_code=payload.country_code,
            kind_code=payload.kind_code,
            include_analytics=payload.include_analytics,
        )
        
        # Аудит вызова
        await AuditService.write(
            db=db,
            action="patent_precheck.international",
            entity_type="patent",
            entity_id=payload.patent_number,
            actor_id=current_user.id,
            payload={
                "country_code": payload.country_code,
                "exists": response.exists,
                "primary_source": response.primary_source,
                "cached": response.cached,
            },
        )
        
        return response
        
    except Exception as e:
        logger.exception("Patent precheck failed")
        raise HTTPException(
            status_code=400,
            detail=f"Patent precheck failed: {str(e)}",
        )


# =============================================================================
# International Patent Search Endpoint
# =============================================================================

@router.post("/search/international", response_model=PatentSearchResponse)
async def patent_search_international(
    payload: PatentSearchRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Международный поиск патентов по ключевым словам.
    
    Выполняет параллельный поиск по указанным странам (или всем доступным),
    агрегирует и дедуплицирует результаты.
    
    Поддерживаемые страны:
    - US (USPTO, PatentsView)
    - EP (EPO OPS)
    - WO (WIPO PATENTSCOPE)
    
    **Требуется авторизация.**
    """
    service = InternationalSearchService(db)
    
    try:
        response = await service.search(
            query=payload.query,
            countries=payload.countries,
            date_from=payload.date_from,
            date_to=payload.date_to,
            page=payload.page,
            per_page=payload.per_page,
        )
        
        # Аудит поиска
        await AuditService.write(
            db=db,
            action="patent_search.international",
            entity_type="patent_search",
            actor_id=current_user.id,
            payload={
                "query": payload.query,
                "countries": payload.countries,
                "total_results": response.total,
                "sources_queried": response.sources_queried,
            },
        )
        
        return response
        
    except Exception as e:
        logger.exception("Patent search failed")
        raise HTTPException(
            status_code=400,
            detail=f"Patent search failed: {str(e)}",
        )


# =============================================================================
# IP Claim Enrichment Endpoint
# =============================================================================

@router.post(
    "/ip-claims/{claim_id}/enrich/international",
    response_model=IpClaimEnrichResponse,
)
async def enrich_ip_claim_international(
    claim_id: str,
    payload: IpClaimEnrichRequest = IpClaimEnrichRequest(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Обогащение IP claim данными из международных патентных API.
    
    Загружает данные из внешних источников (USPTO, EPO OPS, WIPO)
    и обновляет external_metadata в ip_claims.
    
    **Требуется авторизация.**
    **Владелец claim или admin/compliance_officer.**
    """
    # Проверка прав доступа
    from sqlalchemy import select
    from app.models.ip_claim import IpClaim
    
    claim_uuid = uuid.UUID(claim_id)
    stmt = select(IpClaim).where(IpClaim.id == claim_uuid)
    result = await db.execute(stmt)
    claim = result.scalar_one_or_none()
    
    if not claim:
        raise HTTPException(status_code=404, detail="IP claim not found")
    
    # Проверка прав
    if current_user.role not in {"admin", "compliance_officer"} and claim.issuer_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Недостаточно прав для обогащения этого IP claim")
    
    service = PatentDataEnrichmentService(db)
    
    try:
        response = await service.enrich_claim(
            claim_id=claim_id,
            force_refresh=payload.force_refresh,
            sources=payload.sources,
        )
        
        # Аудит обогащения
        if response.enriched:
            await AuditService.write(
                db=db,
                action="ip_claim.enrich.international",
                entity_type="ip_claim",
                entity_id=claim_id,
                actor_id=current_user.id,
                payload={
                    "sources_used": response.sources_used,
                    "updated_fields": response.updated_fields,
                    "status": response.normalized_record.status if response.normalized_record else None,
                },
            )
        
        return response
        
    except Exception as e:
        logger.exception("IP claim enrichment failed")
        raise HTTPException(
            status_code=400,
            detail=f"IP claim enrichment failed: {str(e)}",
        )


# =============================================================================
# Health Check Endpoint
# =============================================================================

@router.get("/health")
async def ip_intel_health():
    """
    Проверка доступности модуля IP Intelligence.
    
    Возвращает статус доступных внешних источников.
    """
    return {
        "status": "healthy",
        "module": "ip_intel",
        "sources": {
            "USPTO": "configured",  # TODO: Проверка API key
            "PATENTSVIEW": "configured",  # Не требует auth
            "EPO_OPS": "configured",  # TODO: Проверка OAuth2
            "WIPO_PCT": "configured",  # TODO: Проверка API key
        },
    }
