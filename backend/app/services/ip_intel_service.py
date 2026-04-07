"""
Сервисы модуля IP Intelligence (ip_intel).

Сервисы:
- PatentDataEnrichmentService: обогащение данных IP claim из внешних API
- PatentStatusCheckService: проверка существования и статуса патента
- InternationalSearchService: международный поиск патентов
"""

import asyncio
import hashlib
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.ip_claim import IpClaim
from app.models.ip_intel import PatentCache, PatentCacheStatus
from app.schemas.ip_intel import (
    NormalizedPatentRecord,
    PatentPrecheckResponse,
    PatentSearchResponse,
    PatentSearchResultItem,
    IpClaimEnrichResponse,
    ExternalApiCallResult,
    TokenizabilityRecommendation,
)
from app.integrations.patent_clients import (
    BasePatentClient,
    UsptoPatentClient,
    PatentsViewClient,
    EpoOpsClient,
    WipoPatentscopeClient,
    create_patent_client,
)

logger = logging.getLogger(__name__)


# =============================================================================
# Вспомогательные функции
# =============================================================================

def _generate_cache_key(source: str, patent_number: str, country_code: str) -> str:
    """Генерация ключа для кэширования."""
    key_string = f"{source}:{country_code}:{patent_number}"
    return hashlib.sha256(key_string.encode()).hexdigest()[:32]


def _generate_search_query_hash(query: str, countries: Optional[List[str]], 
                                 date_from: Optional[str], date_to: Optional[str]) -> str:
    """Генерация хэша поискового запроса для кэширования."""
    key_string = f"{query}:{','.join(countries or [])}:{date_from}:{date_to}"
    return hashlib.sha256(key_string.encode()).hexdigest()


def _get_cache_expiry(hours: int) -> datetime:
    """Расчет времени истечения кэша."""
    return datetime.now(timezone.utc) + timedelta(hours=hours)


def _is_cache_valid(cache_record: PatentCache) -> bool:
    """Проверка валидности кэша."""
    return (
        cache_record.cache_status == PatentCacheStatus.VALID.value
        and cache_record.expires_at > datetime.now(timezone.utc)
    )


def _determine_recommendation(record: NormalizedPatentRecord) -> TokenizabilityRecommendation:
    """
    Определение рекомендации по токенизации на основе данных патента.
    
    Критерии:
    - granted + не expired = recommended
    - pending = requires_review
    - expired/revoked = not_recommended
    - unknown status = caution
    """
    status = record.status or "unknown"
    
    if status == "granted":
        return TokenizabilityRecommendation.RECOMMENDED
    elif status == "pending":
        return TokenizabilityRecommendation.REQUIRES_REVIEW
    elif status in ("expired", "revoked"):
        return TokenizabilityRecommendation.NOT_RECOMMENDED
    else:
        return TokenizabilityRecommendation.CAUTION


# =============================================================================
# PatentStatusCheckService
# =============================================================================

class PatentStatusCheckService:
    """
    Сервис проверки существования и статуса патента.
    
    Используется для precheck перед созданием IP claim.
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self._clients: Dict[str, BasePatentClient] = {}
    
    def _get_client_for_country(self, country_code: str) -> BasePatentClient:
        """Получение клиента для страны."""
        country = country_code.upper()

        if country == "US":
            if "USPTO" not in self._clients:
                self._clients["USPTO"] = UsptoPatentClient()
            return self._clients["USPTO"]
        elif country == "EP":
            if "EPO_OPS" not in self._clients:
                self._clients["EPO_OPS"] = EpoOpsClient()
            return self._clients["EPO_OPS"]
        elif country == "WO":
            if "WIPO_PCT" not in self._clients:
                self._clients["WIPO_PCT"] = WipoPatentscopeClient()
            return self._clients["WIPO_PCT"]
        else:
            raise ValueError(
                f"Unsupported country code: {country_code}. "
                f"Supported: US, EP, WO"
            )
    
    async def check_patent(
        self,
        patent_number: str,
        country_code: str,
        kind_code: Optional[str] = None,
        include_analytics: bool = False,
    ) -> PatentPrecheckResponse:
        """
        Проверка существования и статуса патента.
        
        Args:
            patent_number: Номер патента
            country_code: Код страны (US, EP, WO)
            kind_code: Kind code публикации (опционально)
            include_analytics: Включить дополнительную аналитику
        
        Returns:
            PatentPrecheckResponse с результатом проверки
        """
        warnings = []
        cached = False
        normalized_record: Optional[NormalizedPatentRecord] = None
        primary_source: Optional[str] = None
        analytics: Optional[Dict[str, Any]] = None
        
        # 1. Проверка кэша
        cache_record = await self._get_from_cache(patent_number, country_code)
        if cache_record and _is_cache_valid(cache_record):
            normalized_record = self._cache_to_record(cache_record)
            primary_source = cache_record.source
            cached = True
            logger.info(f"Patent data loaded from cache: {patent_number}")
        
        # 2. Если нет в кэше, запрос к внешнему API
        if not normalized_record:
            client = self._get_client_for_country(country_code)
            result = await client.fetch_patent_by_number(
                patent_number=patent_number,
                country_code=country_code,
                kind_code=kind_code,
            )
            
            if result.success and result.data:
                normalized_record = client._map_to_normalized_record(result.data)
                primary_source = client.SOURCE_NAME

                # Сохранение в кэш
                if normalized_record:
                    await self._save_to_cache(
                        normalized_record,
                        search_patent_number=patent_number,
                    )
            else:
                warnings.append(f"Failed to fetch from {client.SOURCE_NAME}: {result.error_message}")
        
        # 3. Дополнительная аналитика (PatentsView для US)
        if include_analytics and country_code.upper() == "US" and normalized_record:
            analytics = await self._fetch_analytics(patent_number)
        
        # 4. Формирование ответа
        exists = normalized_record is not None
        recommendation = _determine_recommendation(normalized_record) if normalized_record else None
        
        return PatentPrecheckResponse(
            exists=exists,
            primary_source=primary_source,
            normalized_record=normalized_record,
            analytics=analytics,
            recommendation=recommendation,
            warnings=warnings,
            cached=cached,
        )
    
    async def _get_from_cache(
        self,
        patent_number: str,
        country_code: str
    ) -> Optional[PatentCache]:
        """Получение данных из кэша."""
        # Нормализация номера
        clean_number = patent_number.replace(",", "").replace(" ", "").replace("-", "")

        stmt = select(PatentCache).where(
            PatentCache.patent_number == clean_number,
            PatentCache.country_code == country_code.upper(),
            PatentCache.cache_status == PatentCacheStatus.VALID.value,
            PatentCache.expires_at > datetime.now(timezone.utc),
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
    
    async def _save_to_cache(
        self,
        record: NormalizedPatentRecord,
        search_patent_number: Optional[str] = None,
    ):
        """Сохранение нормализованной записи в кэш."""
        from sqlalchemy.dialects.postgresql import insert as pg_insert

        # Используем search_patent_number если есть, иначе source_id
        patent_number = search_patent_number or record.source_id
        clean_number = patent_number.replace(",", "").replace(" ", "").replace("-", "")

        cache_data = {
            "source": record.source,
            "source_id": record.source_id,
            "country_code": record.country_code,
            "patent_number": clean_number,
            "kind_code": record.kind_code,
            "title": record.title,
            "abstract": record.abstract,
            "filing_date": record.filing_date,
            "publication_date": record.publication_date,
            "grant_date": record.grant_date,
            "patent_status": record.status or "unknown",
            "assignees": [a.model_dump() for a in record.assignees] if record.assignees else None,
            "inventors": [i.model_dump() for i in record.inventors] if record.inventors else None,
            "cpc_classes": record.cpc_classes,
            "uspc_classes": record.uspc_classes,
            "ipc_classes": record.ipc_classes,
            "geo_data": record.geo_data.model_dump() if record.geo_data else None,
            "family_ids": record.family_ids,
            "citations_count": record.citations_count,
            "raw_data": record.raw_data,
            "cache_status": PatentCacheStatus.VALID.value,
            "cached_at": datetime.now(timezone.utc),
            "expires_at": _get_cache_expiry(settings.PATENT_CACHE_TTL_HOURS),
        }

        stmt = select(PatentCache).where(
            PatentCache.source == record.source,
            PatentCache.source_id == record.source_id,
        )
        result = await self.db.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing:
            for key, value in cache_data.items():
                setattr(existing, key, value)
        else:
            new_cache = PatentCache(**cache_data)
            self.db.add(new_cache)

        await self.db.flush()
    
    def _cache_to_record(self, cache: PatentCache) -> NormalizedPatentRecord:
        """Конвертация кэш записи в нормализованную запись."""
        from app.schemas.ip_intel import AssigneeInfo, InventorInfo, GeoData

        return NormalizedPatentRecord(
            source=cache.source,
            source_id=cache.source_id,
            country_code=cache.country_code,
            kind_code=cache.kind_code,
            title=cache.title,
            abstract=cache.abstract,
            filing_date=cache.filing_date,
            publication_date=cache.publication_date,
            grant_date=cache.grant_date,
            status=cache.patent_status,
            assignees=[AssigneeInfo(**a) for a in cache.assignees] if cache.assignees else None,
            inventors=[InventorInfo(**i) for i in cache.inventors] if cache.inventors else None,
            cpc_classes=cache.cpc_classes,
            uspc_classes=cache.uspc_classes,
            ipc_classes=cache.ipc_classes,
            geo_data=GeoData(**cache.geo_data) if cache.geo_data else None,
            family_ids=cache.family_ids,
            citations_count=cache.citations_count,
            raw_data=cache.raw_data,
        )
    
    async def _fetch_analytics(self, patent_number: str) -> Optional[Dict[str, Any]]:
        """Получение дополнительной аналитики из PatentsView."""
        try:
            client = PatentsViewClient()
            result = await client.fetch_patent_by_number(patent_number, "US")
            
            if result.success and result.data:
                data = result.data
                return {
                    "citations_count": data.get("citations_count"),
                    "cited_by_count": data.get("cited_by_count"),
                    "cpc_classes": data.get("cpc"),
                    "uspc_classes": data.get("uspc"),
                    "assignee_locations": data.get("assignee_locations"),
                }
        except Exception as e:
            logger.warning(f"Failed to fetch analytics: {e}")
        
        return None


# =============================================================================
# PatentDataEnrichmentService
# =============================================================================

class PatentDataEnrichmentService:
    """
    Сервис обогащения IP claim данными из внешних патентных API.
    
    Используется для обновления external_metadata в ip_claims
    и связанных записей в assets.
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.status_service = PatentStatusCheckService(db)
    
    async def enrich_claim(
        self,
        claim_id: str,
        force_refresh: bool = False,
        sources: Optional[List[str]] = None,
    ) -> IpClaimEnrichResponse:
        """
        Обогащение IP claim данными из внешних API.
        
        Args:
            claim_id: UUID IP claim
            force_refresh: Игнорировать кэш
            sources: Список источников для обогащения
        
        Returns:
            IpClaimEnrichResponse с результатом обогащения
        """
        import uuid
        
        try:
            claim_uuid = uuid.UUID(claim_id)
        except ValueError:
            return IpClaimEnrichResponse(
                claim_id=claim_id,
                enriched=False,
                sources_used=[],
                warnings=["Invalid claim_id format"],
            )
        
        # Загрузка IP claim
        stmt = select(IpClaim).where(IpClaim.id == claim_uuid)
        result = await self.db.execute(stmt)
        claim = result.scalar_one_or_none()
        
        if not claim:
            return IpClaimEnrichResponse(
                claim_id=claim_id,
                enriched=False,
                sources_used=[],
                warnings=["IP claim not found"],
            )
        
        sources_used: List[str] = []
        updated_fields: List[str] = []
        warnings: List[str] = []
        normalized_record: Optional[NormalizedPatentRecord] = None
        
        # Определение страны/юрисдикции
        country_code = claim.jurisdiction or "US"  # По умолчанию US
        patent_number = claim.patent_number
        
        # Обогащение по каждому источнику
        if not sources:
            # По умолчанию используем все подходящие источники
            sources = self._get_default_sources_for_country(country_code)
        
        for source in sources:
            try:
                client = create_patent_client(source)
                result = await client.fetch_patent_by_number(
                    patent_number=patent_number,
                    country_code=country_code,
                )
                
                if result.success and result.data:
                    record = client._map_to_normalized_record(result.data)
                    if record:
                        normalized_record = record  # Последняя успешная запись
                        sources_used.append(source)
                        
                        # Обновление полей claim
                        field_updates = self._merge_metadata(claim, record)
                        updated_fields.extend(field_updates)
                else:
                    warnings.append(f"{source}: {result.error_message}")
                    
            except Exception as e:
                logger.warning(f"Failed to enrich from {source}: {e}")
                warnings.append(f"{source}: {str(e)}")
        
        # Сохранение обновлений
        if normalized_record:
            claim.external_metadata = normalized_record.model_dump()
            
            # Обновление основных полей
            if normalized_record.title and not claim.patent_title:
                claim.patent_title = normalized_record.title
                updated_fields.append("patent_title")
            
            claim.prechecked = True
            claim.precheck_status = normalized_record.status
            claim.source_id = normalized_record.source_id
            claim.checked_at = datetime.now(timezone.utc)
            
            await self.db.flush()
        
        return IpClaimEnrichResponse(
            claim_id=claim_id,
            enriched=normalized_record is not None,
            sources_used=sources_used,
            normalized_record=normalized_record,
            updated_fields=list(set(updated_fields)),
            warnings=warnings,
        )
    
    def _get_default_sources_for_country(self, country_code: str) -> List[str]:
        """Получение источников по умолчанию для страны."""
        country = country_code.upper()
        
        if country == "US":
            return ["USPTO", "PATENTSVIEW"]
        elif country == "EP":
            return ["EPO_OPS"]
        elif country == "WO":
            return ["WIPO_PCT"]
        else:
            return ["USPTO"]  # По умолчанию
    
    def _merge_metadata(
        self, 
        claim: IpClaim, 
        record: NormalizedPatentRecord
    ) -> List[str]:
        """
        Слияние метаданных патента с existing данными claim.
        
        Returns список обновленных полей.
        """
        updated = []
        
        # Получение существующих метаданных
        existing = claim.external_metadata or {}
        
        # Слияние с новыми данными
        new_data = record.model_dump(exclude={"raw_data"})
        
        for key, value in new_data.items():
            if value is not None and existing.get(key) != value:
                existing[key] = value
                updated.append(key)
        
        return updated


# =============================================================================
# InternationalSearchService
# =============================================================================

class InternationalSearchService:
    """
    Сервис международного поиска патентов.
    
    Оркестрирует параллельные запросы к нескольким источникам,
    агрегирует и дедуплицирует результаты.
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self._clients: Dict[str, BasePatentClient] = {}
    
    def _get_clients_for_countries(
        self, 
        countries: Optional[List[str]]
    ) -> Dict[str, BasePatentClient]:
        """Получение клиентов для списка стран."""
        clients = {}
        
        if not countries:
            # По умолчанию все источники
            countries = ["US", "EP", "WO"]
        
        for country in countries:
            country = country.upper()
            
            if country == "US" and "USPTO" not in clients:
                clients["USPTO"] = UsptoPatentClient()
            elif country == "EP" and "EPO_OPS" not in clients:
                clients["EPO_OPS"] = EpoOpsClient()
            elif country == "WO" and "WIPO_PCT" not in clients:
                clients["WIPO_PCT"] = WipoPatentscopeClient()
        
        return clients
    
    async def search(
        self,
        query: str,
        countries: Optional[List[str]] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> PatentSearchResponse:
        """
        Международный поиск патентов.
        
        Args:
            query: Поисковый запрос
            countries: Список стран для поиска
            date_from: Дата от (ISO)
            date_to: Дата до (ISO)
            page: Номер страницы
            per_page: Элементов на странице
        
        Returns:
            PatentSearchResponse с агрегированными результатами
        """
        clients = self._get_clients_for_countries(countries)
        sources_queried = list(clients.keys())
        
        # Параллельные запросы ко всем источникам
        search_tasks = [
            self._search_source(client, query, page, per_page, date_from, date_to)
            for client in clients.values()
        ]
        
        results = await asyncio.gather(*search_tasks, return_exceptions=True)
        
        # Агрегация результатов
        all_items: List[PatentSearchResultItem] = []
        total = 0
        seen_ids: set = set()
        deduplicated_count = 0
        
        for result in results:
            if isinstance(result, Exception):
                logger.warning(f"Search failed: {result}")
                continue
            
            source_items, source_total = result
            total += source_total
            
            for item in source_items:
                # Дедупликация по source_id + country_code
                unique_id = f"{item.source}:{item.source_id}"
                if unique_id in seen_ids:
                    deduplicated_count += 1
                else:
                    seen_ids.add(unique_id)
                    all_items.append(item)
        
        # Пагинация
        start_idx = (page - 1) * per_page
        end_idx = start_idx + per_page
        paginated_items = all_items[start_idx:end_idx]
        
        total_pages = (len(all_items) + per_page - 1) // per_page if all_items else 1
        
        return PatentSearchResponse(
            total=len(all_items),
            page=page,
            per_page=per_page,
            total_pages=total_pages,
            results=paginated_items,
            sources_queried=sources_queried,
            deduplicated_count=deduplicated_count,
        )
    
    async def _search_source(
        self,
        client: BasePatentClient,
        query: str,
        page: int,
        per_page: int,
        date_from: Optional[str],
        date_to: Optional[str],
    ) -> Tuple[List[PatentSearchResultItem], int]:
        """Поиск в одном источнике."""
        try:
            result = await client.search_patents(
                query=query,
                page=page,
                per_page=per_page,
                date_from=date_from,
                date_to=date_to,
            )
            
            if not result.success or not result.data:
                return [], 0
            
            # Парсинг результатов
            items = []
            data = result.data
            
            # Обработка различных форматов ответов
            patents = data.get("patents", []) or data.get("results", []) or data.get("publications", [])
            total = data.get("total", data.get("count", len(patents)))
            
            for patent in patents:
                record = client._map_to_normalized_record(patent)
                if record:
                    items.append(PatentSearchResultItem(
                        source=client.SOURCE_NAME,
                        source_id=record.source_id,
                        country_code=record.country_code,
                        title=record.title,
                        publication_date=record.publication_date,
                        status=record.status,
                        assignees=[a.get("name") for a in record.assignees] if record.assignees else None,
                    ))
            
            return items, total
            
        except Exception as e:
            logger.warning(f"Search failed for {client.SOURCE_NAME}: {e}")
            return [], 0


