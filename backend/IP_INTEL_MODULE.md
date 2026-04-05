# IP Intelligence Module (ip_intel)

## Архитектура

Модуль `ip_intel` представляет собой интеграционный слой между платформой IPChain и международными патентными API. Он обеспечивает:

1. **Проверку существования и статуса патентов** через официальные реестры (USPTO, EPO OPS, WIPO)
2. **Обогащение IP claim** библиографическими данными из внешних источников
3. **Международный поиск** патентов по ключевым словам с агрегацией результатов

### Компоненты

```
app/
├── schemas/ip_intel.py          # Pydantic DTO и request/response схемы
├── models/ip_intel.py           # SQLAlchemy модели кэширования
├── models/ip_claim.py           # Расширенная модель IP claim (external_metadata)
├── integrations/patent_clients.py  # HTTP клиенты для внешних API
├── services/ip_intel_service.py    # Бизнес-логика (сервисы)
└── api/v1/endpoints/ip_intel.py    # REST endpoints
```

### Внешние интеграции

| Источник | Регион | Auth | Лимиты | Назначение |
|----------|--------|------|--------|------------|
| **USPTO Patent API** | US | API Key | 5 calls/sec | Проверка US патентов, статус |
| **PatentsView** | US | Нет | 10 calls/sec | Аналитика, цитирования, CPC/USPC |
| **EPO OPS** | EP | OAuth2 | 4GB/month | Европейские патенты, семейства |
| **WIPO PATENTSCOPE** | Global | API Key (opt) | 10 calls/sec | PCT заявки, международный поиск |

---

## REST API

### 1. Проверка патента (Precheck)

```http
POST /api/v1/patents/precheck/international
Authorization: Bearer <token>
Content-Type: application/json

{
  "patent_number": "US20230012345",
  "country_code": "US",
  "kind_code": "A1",
  "search_mode": "exact",
  "include_analytics": true
}
```

**Ответ:**

```json
{
  "exists": true,
  "primary_source": "USPTO",
  "normalized_record": {
    "source": "USPTO",
    "source_id": "US20230012345",
    "country_code": "US",
    "title": "Battery Management System",
    "status": "granted",
    "filing_date": "2021-05-15",
    "publication_date": "2023-01-10"
  },
  "analytics": {
    "citations_count": 42,
    "cpc_classes": ["H01M10/0525"]
  },
  "recommendation": "recommended",
  "cached": false
}
```

---

### 2. Международный поиск

```http
POST /api/v1/patents/search/international
Authorization: Bearer <token>
Content-Type: application/json

{
  "query": "artificial intelligence battery management",
  "countries": ["US", "EP", "WO"],
  "date_from": "2020-01-01",
  "date_to": "2026-01-01",
  "page": 1,
  "per_page": 20
}
```

**Ответ:**

```json
{
  "total": 125,
  "page": 1,
  "per_page": 20,
  "total_pages": 7,
  "results": [
    {
      "source": "WIPO_PCT",
      "source_id": "WO2025123456",
      "country_code": "WO",
      "title": "AI-Based Battery Optimization",
      "publication_date": "2025-04-01",
      "status": "published"
    }
  ],
  "sources_queried": ["USPTO", "EPO_OPS", "WIPO_PCT"],
  "deduplicated_count": 15
}
```

---

### 3. Обогащение IP Claim

```http
POST /api/v1/patents/ip-claims/{claim_id}/enrich/international
Authorization: Bearer <token>
Content-Type: application/json

{
  "force_refresh": false,
  "sources": ["USPTO", "PATENTSVIEW"]
}
```

**Ответ:**

```json
{
  "claim_id": "550e8400-e29b-41d4-a716-446655440000",
  "enriched": true,
  "sources_used": ["USPTO", "PATENTSVIEW"],
  "normalized_record": { /* ... */ },
  "updated_fields": ["patent_title", "external_metadata", "precheck_status"],
  "warnings": []
}
```

---

## Каноническая модель данных

```python
class NormalizedPatentRecord(BaseModel):
    source: Literal["USPTO", "PATENTSVIEW", "EPO_OPS", "WIPO_PCT"]
    source_id: str
    country_code: str  # US, EP, WO
    kind_code: Optional[str]
    title: str
    abstract: Optional[str]
    filing_date: Optional[str]  # ISO
    publication_date: Optional[str]  # ISO
    grant_date: Optional[str]  # ISO
    status: Optional[Literal["granted", "pending", "expired", "revoked", "unknown"]]
    assignees: Optional[List[Dict]]  # [{name, type, country}]
    inventors: Optional[List[Dict]]  # [{name, country}]
    cpc_classes: Optional[List[str]]
    uspc_classes: Optional[List[str]]
    ipc_classes: Optional[List[str]]
    citations_count: Optional[int]
    geo_data: Optional[Dict]  # {assignee_countries, inventor_countries}
    family_ids: Optional[List[str]]
    raw_data: Optional[Dict]  # Для отладки
```

---

## База данных

### Таблица `patent_cache`

Кэширует нормализованные данные патентов на 48 часов.

| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | Primary key |
| source | VARCHAR | Источник (USPTO, EPO_OPS, etc.) |
| source_id | VARCHAR | ID в системе источника |
| country_code | VARCHAR | Код страны |
| patent_number | VARCHAR | Номер патента |
| title | VARCHAR | Название |
| status | VARCHAR | Статус |
| assignees | JSONB | Правообладатели |
| inventors | JSONB | Изобретатели |
| cpc_classes | JSONB | CPC классы |
| raw_data | JSONB | Сырые данные |
| expires_at | TIMESTAMP | Время истечения кэша |

### Таблица `ip_claims` (расширена)

Добавлено поле:
- `external_metadata` JSONB — нормализованные данные из внешних API

---

## Кэширование

### Стратегия

1. **PatentCache** — данные патентов кэшируются на 48-72 часа (статичны)
2. **PatentSearchCache** — результаты поиска на 1-6 часов (меняются чаще)
3. **Redis** (опционально) — быстрый слой поверх PostgreSQL

### Ключ кэша

```python
key = f"{source}:{country_code}:{patent_number}"
```

---

## Rate Limiting и Retry

### Rate Limiting

```python
# В config.py
EXTERNAL_API_RATE_LIMIT = 5.0  # calls per second
```

Каждый клиент имеет semaphore для ограничения параллельных запросов.

### Retry Policy

```python
@retry(
    retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError))
    | retry_if_result(lambda r: r.status_code in {429, 500, 502, 503, 504}),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=30),
)
```

---

## Аудит

Все вызовы внешних API логируются в `audit_logs`:

```python
await AuditService.write(
    db=db,
    action="EXTERNAL_API_CALL",
    entity_type="external_api",
    payload={
        "endpoint": "/patents/grants/US123456",
        "source": "USPTO",
        "status_code": 200,
        "latency_ms": 150,
        "request_id": "uuid"
    }
)
```

---

## Рекомендации по токенизации

| Статус патента | Рекомендация | Описание |
|----------------|--------------|----------|
| `granted` | `recommended` | Активный патент, готов к токенизации |
| `pending` | `requires_review` | Заявка, требуется проверка юристом |
| `expired` | `not_recommended` | Истёк, не рекомендуется |
| `revoked` | `not_recommended` | Аннулирован, не рекомендуется |
| `unknown` | `caution` | Неизвестно, требуется ручная проверка |

---

## Настройка

### Переменные окружения (.env)

```bash
# USPTO API Key - register at https://developer.uspto.gov/
USPTO_API_KEY=your_key_here

# EPO OPS OAuth2 - register at https://worldwide.espacenet.com/ops
EPO_OPS_CONSUMER_KEY=your_consumer_key
EPO_OPS_CONSUMER_SECRET=your_consumer_secret

# WIPO PATENTSCOPE (optional)
WIPO_API_KEY=your_key_here

# Redis (optional)
REDIS_URL=redis://localhost:6379/0

# Cache TTL
PATENT_CACHE_TTL_HOURS=48

# Rate limiting
EXTERNAL_API_RATE_LIMIT=5.0
```

---

## Миграции

Применить миграцию:

```bash
alembic upgrade head
```

Создаст таблицы:
- `patent_cache`
- `patent_search_cache`
- Добавит поле `external_metadata` в `ip_claims`

---

## TODO для доработки

1. **EPO OPS OAuth2** — реализовать полноценный client credentials flow в `EpoOpsClient._ensure_valid_token()`

2. **Парсинг XML EPO OPS** — реализовать `EpoOpsClient._parse_epo_xml()` с использованием `xml.etree.ElementTree`

3. **Redis кэш** — добавить Redis-слой в сервисы при наличии `settings.REDIS_URL`

4. **Детальный парсинг USPTO** — расширить `UsptoPatentClient._map_to_normalized_record()` для всех полей

5. **WIPO API Catalog** — добавить клиент для discovery API других национальных офисов

6. **Дедупликация по family** — улучшить логику дедупликации в `InternationalSearchService` по priority numbers

7. **Health checks** — добавить реальную проверку доступности API в `/health` endpoint

---

## Тестирование

### Unit тесты (пример)

```python
import pytest
from app.services.ip_intel_service import PatentStatusCheckService

@pytest.mark.asyncio
async def test_patent_precheck_us(db_session):
    service = PatentStatusCheckService(db_session)
    response = await service.check_patent(
        patent_number="US20230012345",
        country_code="US",
        include_analytics=True
    )
    assert response.exists in (True, False)
    assert response.primary_source in ("USPTO", "PATENTSVIEW")
```

### Интеграционные тесты

Требуют действительных API ключей. Запускать с `.env` файлом.

---

## Лицензирование внешних API

| API | Лицензия | Коммерческое использование |
|-----|----------|---------------------------|
| USPTO | Public Domain | ✅ Да |
| PatentsView | CC0 / Public Domain | ✅ Да |
| EPO OPS | EPO Terms of Use | ✅ Да (с ограничениями) |
| WIPO PATENTSCOPE | WIPO Terms | ✅ Да (с ограничениями) |

**Важно:** Проверить актуальные условия использования перед production развёртыванием.
