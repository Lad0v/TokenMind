"""
SQLAlchemy модели для модуля IP Intelligence (ip_intel).

Модели для:
- Кэширования патентных данных
- Результатов поиска
- Расширения ip_claims.external_metadata
"""

import enum
import uuid
from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING

from sqlalchemy import (
    String,
    DateTime,
    Index,
    Text,
    Enum as SAEnum,
    JSON,
    Boolean,
    Integer,
    UniqueConstraint,
    ForeignKey,
)
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.ip_claim import IpClaim


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# =============================================================================
# Enums
# =============================================================================

class PatentCacheSource(str, enum.Enum):
    """Источники кэшированных данных."""
    USPTO = "USPTO"
    PATENTSVIEW = "PATENTSVIEW"
    EPO_OPS = "EPO_OPS"
    WIPO_PCT = "WIPO_PCT"


class PatentCacheStatus(str, enum.Enum):
    """Статус кэшированной записи."""
    VALID = "valid"
    EXPIRED = "expired"
    ERROR = "error"


# =============================================================================
# Модели кэширования
# =============================================================================

class PatentCache(Base):
    """
    Кэш нормализованных патентных данных.
    
    Патентные данные относительно статичны, кэшируем на 24-72 часа.
    """
    __tablename__ = "patent_cache"
    __table_args__ = (
        UniqueConstraint("source", "source_id", name="uq_patent_cache_source_id"),
        Index("ix_patent_cache_country_number", "country_code", "patent_number"),
        Index("ix_patent_cache_expires", "expires_at"),
        Index("ix_patent_cache_cache_status", "cache_status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    
    # Идентификаторы
    source: Mapped[str] = mapped_column(
        SAEnum(*[s.value for s in PatentCacheSource], name="patent_cache_source"),
        nullable=False
    )
    source_id: Mapped[str] = mapped_column(String(128), nullable=False)
    country_code: Mapped[str] = mapped_column(String(10), nullable=False)
    patent_number: Mapped[str] = mapped_column(String(100), nullable=False)
    kind_code: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    
    # Нормализованные данные (JSONB)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    abstract: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    filing_date: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    publication_date: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    grant_date: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # Статус патента (granted/pending/expired/revoked/unknown)
    patent_status: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)

    # JSONB поля для сложных структур
    assignees: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    inventors: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    cpc_classes: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    uspc_classes: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    ipc_classes: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    geo_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    family_ids: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    citations_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Сырые данные от источника (для отладки/повторной обработки)
    raw_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Метаданные кэша
    cache_status: Mapped[str] = mapped_column(
        SAEnum(*[s.value for s in PatentCacheStatus], name="patent_cache_status"),
        nullable=False,
        default=PatentCacheStatus.VALID
    )
    cached_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    error_message: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    
    # Связь с IP claim (опционально)
    ip_claim_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("ip_claims.id", ondelete="SET NULL"), nullable=True
    )
    ip_claim: Mapped[Optional["IpClaim"]] = relationship(
        "IpClaim", foreign_keys=[ip_claim_id], back_populates="patent_cache_records"
    )


# =============================================================================
# Модели результатов поиска
# =============================================================================

class PatentSearchCache(Base):
    """
    Кэш результатов поиска патентов.
    
    Кэшируем результаты поиска на меньшее время (1-6 часов),
    так как поисковые выдачи могут обновляться чаще.
    """
    __tablename__ = "patent_search_cache"
    __table_args__ = (
        Index("ix_patent_search_cache_query", "query_hash"),
        Index("ix_patent_search_cache_expires", "expires_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    
    # Хэш запроса для дедупликации
    query_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    query_text: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Параметры поиска
    countries: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    date_from: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    date_to: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    
    # Результаты (массив нормализованных записей)
    results: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    total_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    sources_queried: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    # Метаданные
    cached_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


# =============================================================================
# Расширение модели Back (добавляется в app/models/ip_claim.py)
# =============================================================================
# 
# В app/models/ip_claim.py необходимо добавить поле external_metadata:
#
# class Back(Base):
#     # ... existing fields ...
#     
#     # JSONB поле для внешних метаданных из патентных API
#     external_metadata: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
#     
#     # Связь с кэшем патентов
#     patent_cache_records: Mapped[List["PatentCache"]] = relationship(
#         "PatentCache", foreign_keys="PatentCache.ip_claim_id", back_populates="ip_claim"
#     )
#
# =============================================================================


# =============================================================================
# Модель для аудита внешних API вызовов (расширение AuditLog)
# =============================================================================
# 
# В app/models/common.py уже есть AuditLog.
# Для внешних API вызовов используем action = "EXTERNAL_API_CALL"
# payload содержит:
# {
#     "endpoint": "...",
#     "source": "USPTO",
#     "status_code": 200,
#     "latency_ms": 150,
#     "request_id": "...",
#     "patent_number": "..."  # без PII
# }
# =============================================================================
