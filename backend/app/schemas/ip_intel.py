"""
Pydantic схемы для модуля IP Intelligence (ip_intel).

Нормализованные DTO для работы с международными патентными API:
- USPTO Patent API
- PatentsView
- EPO OPS
- WIPO PATENTSCOPE
"""

from datetime import date
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


# =============================================================================
# Enums
# =============================================================================

class PatentSource(str):
    USPTO = "USPTO"
    PATENTSVIEW = "PATENTSVIEW"
    EPO_OPS = "EPO_OPS"
    WIPO_PCT = "WIPO_PCT"


class PatentStatusEnum(str):
    granted = "granted"
    pending = "pending"
    expired = "expired"
    revoked = "revoked"
    unknown = "unknown"


class TokenizabilityRecommendation(str):
    RECOMMENDED = "recommended"
    CAUTION = "caution"
    NOT_RECOMMENDED = "not_recommended"
    REQUIRES_REVIEW = "requires_review"


# =============================================================================
# Нормализованная запись патента (Canonical DTO)
# =============================================================================

class AssigneeInfo(BaseModel):
    """Информация о правообладателе."""
    name: Optional[str] = Field(None, description="Название организации или имя")
    type: Optional[str] = Field(None, description="Тип: individual, company, government")
    country: Optional[str] = Field(None, description="Код страны")


class InventorInfo(BaseModel):
    """Информация об изобретателе."""
    name: Optional[str] = Field(None, description="Имя изобретателя")
    country: Optional[str] = Field(None, description="Код страны")


class GeoData(BaseModel):
    """Географические данные."""
    assignee_countries: Optional[List[str]] = Field(None, description="Страны правообладателей")
    inventor_countries: Optional[List[str]] = Field(None, description="Страны изобретателей")


class NormalizedPatentRecord(BaseModel):
    """
    Каноническая нормализованная запись патента.
    
    Все внешние API приводятся к этой структуре на уровне сервиса.
    """
    source: Literal["USPTO", "PATENTSVIEW", "EPO_OPS", "WIPO_PCT"] = Field(
        ..., description="Источник данных"
    )
    source_id: str = Field(..., description="Идентификатор в системе источника")
    country_code: str = Field(..., description="Код страны: US, EP, WO, etc.")
    kind_code: Optional[str] = Field(None, description="Kind code публикации")
    title: str = Field(..., description="Название патента")
    abstract: Optional[str] = Field(None, description="Аннотация")
    filing_date: Optional[str] = Field(None, description="Дата подачи заявки (ISO)")
    publication_date: Optional[str] = Field(None, description="Дата публикации (ISO)")
    grant_date: Optional[str] = Field(None, description="Дата выдачи патента (ISO)")
    status: Optional[Literal["granted", "pending", "expired", "revoked", "unknown"]] = Field(
        None, description="Статус патента"
    )
    assignees: Optional[List[AssigneeInfo]] = Field(None, description="Правообладатели")
    inventors: Optional[List[InventorInfo]] = Field(None, description="Изобретатели")
    cpc_classes: Optional[List[str]] = Field(None, description="CPC классы")
    uspc_classes: Optional[List[str]] = Field(None, description="USPC классы")
    ipc_classes: Optional[List[str]] = Field(None, description="IPC классы")
    citations_count: Optional[int] = Field(None, description="Количество цитирований")
    cited_by_count: Optional[int] = Field(None, description="Количество цитирований другими")
    geo_data: Optional[GeoData] = Field(None, description="Географические данные")
    family_ids: Optional[List[str]] = Field(None, description="Идентификаторы патентного семейства")
    priority_numbers: Optional[List[str]] = Field(None, description="Номера приоритета")
    raw_data: Optional[Dict[str, Any]] = Field(None, description="Сырые данные от источника (для отладки)")

    @field_validator("filing_date", "publication_date", "grant_date", mode="before")
    @classmethod
    def normalize_date(cls, v: Any) -> Optional[str]:
        """Нормализация даты в ISO формат."""
        if v is None:
            return None
        if isinstance(v, date):
            return v.isoformat()
        if isinstance(v, str):
            # Попытка нормализовать различные форматы
            return v[:10] if len(v) >= 10 else None
        return None


# =============================================================================
# Request/Response DTO для REST endpoints
# =============================================================================

class PatentPrecheckRequest(BaseModel):
    """Запрос на проверку существования и статуса патента."""
    patent_number: str = Field(..., description="Номер патента")
    country_code: str = Field(..., description="Код страны: US, EP, WO")
    kind_code: Optional[str] = Field(None, description="Kind code (опционально)")
    search_mode: Literal["exact", "fuzzy"] = Field("exact", description="Режим поиска")
    include_analytics: bool = Field(False, description="Включить аналитику (цитирования, классы)")


class PatentPrecheckResponse(BaseModel):
    """Ответ проверки патента."""
    exists: bool = Field(..., description="Существует ли патент")
    primary_source: Optional[str] = Field(None, description="Основной источник данных")
    normalized_record: Optional[NormalizedPatentRecord] = Field(None, description="Нормализованная запись")
    analytics: Optional[Dict[str, Any]] = Field(None, description="Дополнительная аналитика")
    recommendation: Optional[str] = Field(None, description="Рекомендация по токенизации")
    warnings: List[str] = Field(default_factory=list, description="Предупреждения")
    cached: bool = Field(False, description="Данные из кэша")


class PatentSearchRequest(BaseModel):
    """Запрос международного поиска патентов."""
    query: str = Field(..., description="Поисковый запрос (ключевые слова, номер, заявитель)")
    countries: Optional[List[str]] = Field(None, description="Список стран для поиска")
    date_from: Optional[str] = Field(None, description="Дата от (ISO)")
    date_to: Optional[str] = Field(None, description="Дата до (ISO)")
    page: int = Field(1, ge=1, description="Номер страницы")
    per_page: int = Field(20, ge=1, le=100, description="Элементов на странице")


class PatentSearchResultItem(BaseModel):
    """Элемент результата поиска."""
    source: str
    source_id: str
    country_code: str
    title: str
    publication_date: Optional[str]
    status: Optional[str]
    assignees: Optional[List[str]]
    relevance_score: Optional[float] = Field(None, description="Оценка релевантности")


class PatentSearchResponse(BaseModel):
    """Ответ международного поиска."""
    total: int = Field(..., description="Общее количество результатов")
    page: int = Field(..., description="Текущая страница")
    per_page: int = Field(..., description="Элементов на странице")
    total_pages: int = Field(..., description="Общее количество страниц")
    results: List[PatentSearchResultItem] = Field(..., description="Результаты")
    sources_queried: List[str] = Field(..., description="Запрошенные источники")
    deduplicated_count: int = Field(..., description="Количество дубликатов удалено")


class IpClaimEnrichRequest(BaseModel):
    """Запрос на обогащение IP claim данными из внешних API."""
    force_refresh: bool = Field(False, description="Игнорировать кэш и обновить данные")
    sources: Optional[List[Literal["USPTO", "PATENTSVIEW", "EPO_OPS", "WIPO_PCT"]]] = Field(
        None, description="Источники для обогащения (по умолчанию все подходящие)"
    )


class IpClaimEnrichResponse(BaseModel):
    """Ответ обогащения IP claim."""
    claim_id: str
    enriched: bool = Field(..., description="Удалось ли обогатить")
    sources_used: List[str] = Field(..., description="Использованные источники")
    normalized_record: Optional[NormalizedPatentRecord] = Field(None, description="Нормализованная запись")
    updated_fields: List[str] = Field(default_factory=list, description="Обновленные поля")
    warnings: List[str] = Field(default_factory=list, description="Предупреждения")


# =============================================================================
# Внутренние DTO для сервисов
# =============================================================================

class ExternalApiCallResult(BaseModel):
    """Результат вызова внешнего API."""
    source: str
    success: bool
    status_code: Optional[int] = None
    latency_ms: Optional[float] = None
    error_message: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    request_id: Optional[str] = None


class SearchResult(BaseModel):
    """Результат поиска от одного источника."""
    source: str
    total: int
    items: List[NormalizedPatentRecord]
    page: int
    per_page: int
