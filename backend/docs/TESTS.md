# Тестирование — Руководство

> Версия: v2.3 (05.04.2026)

## Обзор

Проект использует **pytest + pytest-asyncio + respx** для тестирования backend-кода. Все тесты — асинхронные, работают с in-memory SQLite через SQLAlchemy Async.

| Инструмент | Назначение |
|------------|-----------|
| **pytest** | Тест-раннер, фикстуры, assertions |
| **pytest-asyncio** | Запуск async-тестов (`async def test_...`) |
| **respx** | Мокирование внешних HTTP-запросов (USPTO, EPO, WIPO, PatentsView) |
| **httpx.AsyncClient + ASGITransport** | Тестирование API-эндпоинтов без запуска сервера |
| **aiosqlite** | In-memory SQLite для изоляции тестов |

## Запуск тестов

```bash
# Все тесты
python -m pytest

# Конкретный файл
python -m pytest tests/test_patent_clients.py -v

# Один тест
python -m pytest tests/test_patent_clients.py::test_uspto_fetch_grant_success -v

# Тесты с отчётом о покрытии (нужен pytest-cov)
python -m pytest --cov=app --cov-report=term-missing

# Только сервисные тесты (без API)
python -m pytest tests/test_patent_clients.py tests/services/ -v
```

## Структура тестов

```
tests/
├── conftest.py                    # Общие фикстуры (db, user, auth_headers)
├── test_patent_clients.py         # 31 тест — внешние API-клиенты
├── test_ip_intel.py               # 19 тестов — IP Intel сервисы
├── test_auth.py                   # Auth endpoints
├── test_users.py                  # User endpoints
├── test_ip_claims.py              # IP Claims endpoints
├── test_main.py                   # Health check, ping
├── test_security.py               # JWT, password hashing
├── test_audit.py                  # Audit logging
├── test_patent_precheck.py        # Patent precheck endpoints
├── test_integration_flows.py      # End-to-end сценарии
└── services/
    ├── test_otp_sender.py         # Email/SMS доставка
    ├── test_otp_email.py          # OTP через email
    └── test_file_storage.py       # Загрузка файлов
```

## Общие фикстуры (conftest.py)

### `db_session` — AsyncSession
In-memory SQLite сессия. Каждый тест работает в транзакции, которая откатывается после теста. Данные не сохраняются между тестами.

```python
async def test_something(db_session: AsyncSession):
    # db_session уже готова к работе
    user = User(email="test@example.com")
    db_session.add(user)
    await db_session.flush()
```

### `make_user` — Фабрика пользователей
Создаёт пользователя в БД с нужными ролью и статусом.

```python
async def test_admin_action(make_user, db_session):
    admin = await make_user(role="admin", status="active")
    user = await make_user(role="user", email="custom@example.com")
```

### `auth_headers` — Заголовки авторизации
Генерирует `Authorization: Bearer <token>` для указанного пользователя.

```python
async def test_protected_endpoint(make_user, auth_headers, client):
    user = await make_user()
    headers = auth_headers(user)
    resp = await client.get("/api/v1/users/profile", headers=headers)
```

### `client` — AsyncClient (ASGI)
HTTP-клиент, подключённый к FastAPI-приложению напрямую (без сети).

```python
async def test_endpoint(client):
    resp = await client.post("/api/v1/auth/login", json={"email": "...", "password": "..."})
    assert resp.status_code == 200
```

---

## Тесты: Patent Clients (31 тест)

Файл: `tests/test_patent_clients.py`

### USPTO Client (14 тестов)

| Тест | Что проверяет |
|------|--------------|
| `test_uspto_fetch_grant_success` | Grant найден → success, данные вернулись |
| `test_uspto_fallback_to_application` | Grant пуст → fallback на Applications search |
| `test_uspto_both_grant_and_application_not_found` | Оба источника пуст → not found |
| `test_uspto_application_with_continuity` | Application найден → вызван `/continuity` для статуса |
| `test_uspto_continuity_failure_does_not_break_fetch` | Continuity упал → application данные всё равно возвращены |
| `test_uspto_search_patents` | Поиск по ключевым словам → результаты |
| `test_uspto_search_with_date_range` | Поиск с `date_from` / `date_to` |
| `test_uspto_search_empty_results` | Ничего не найдено → пустой список, success=True |
| `test_uspto_retries_on_429_then_success` | Rate limit 429 × 2 → retry → success |
| `test_uspto_retries_on_503_then_success` | Server error 503 → retry → success |
| `test_uspto_map_to_normalized_record_grant` | Grant → корректная NormalizedPatentRecord |
| `test_uspto_map_to_normalized_record_application` | Application → корректная запись |
| `test_uspto_map_to_normalized_record_with_continuity` | Continuity статус приоритетнее основного |
| `test_uspto_map_empty_data` | Пустой input → None |

### Вспомогательные методы (4 теста)

| Тест | Что проверяет |
|------|--------------|
| `test_uspto_extract_classes_mixed` | Извлечение классов из строк и объектов |
| `test_uspto_parse_assignees_mixed` | Парсинг assignees (строки и dict) |
| `test_uspto_parse_inventors_mixed` | Парсинг inventors (строки и dict) |
| `test_uspto_normalize_patent_number` | Очистка номера от пробелов, дефисов, запятых |

### Другие клиенты (7 тестов)

| Тест | Клиент |
|------|--------|
| `test_patentsview_fetch_success` | PatentsView (без авторизации) |
| `test_epo_ops_fetch_success` | EPO OPS (OAuth2) |
| `test_wipo_fetch_success` | WIPO PATENTSCOPE |
| `test_create_patent_client_uspto` | Фабрика → UsptoPatentClient |
| `test_create_patent_client_patentsview` | Фабрика → PatentsViewClient |
| `test_create_patent_client_epo` | Фабрика → EpoOpsClient |
| `test_create_patent_client_wipo` | Фабрика → WipoPatentscopeClient |
| `test_create_patent_client_unknown` | Фабрика → ValueError |

### Нормализация статусов (5 тестов)

| Тест | Маппинг |
|------|---------|
| `test_normalize_status_granted` | Grant, Patented, Active → granted |
| `test_normalize_status_expired` | Abandoned, Expired → expired |
| `test_normalize_status_pending` | Pending, Application → pending |
| `test_normalize_status_revoked` | Revoked → revoked |
| `test_normalize_status_unknown` | Нераспознанные, None → unknown |

---

## Тесты: IP Intel Service (19 тестов)

Файл: `tests/test_ip_intel.py`

### PatentStatusCheckService (6 тестов)

| Тест | Сценарий |
|------|----------|
| `test_check_patent_cache_miss_then_api` | Нет в кэше → запрос к USPTO → сохранение |
| `test_check_patent_cache_hit` | Валидный кэш → без API вызова |
| `test_check_patent_expired_cache_calls_api` | Истёкший кэш → новый запрос к API |
| `test_check_patent_not_found` | USPTO вернул пуст → exists=False |
| `test_check_patent_unsupported_country` | Страна JP → ValueError |
| `test_recommendation_granted` | Granted patent → recommended |
| `test_recommendation_pending` | Pending application → requires_review |

### Cache (2 теста)

| Тест | Сценарий |
|------|----------|
| `test_cache_round_trip` | Save → Load → Convert: все поля сохранены |
| `test_save_to_cache_upsert` | Повторный save → обновление, не дубликат |

### PatentDataEnrichmentService (3 теста)

| Тест | Сценарий |
|------|----------|
| `test_enrich_claim_success` | Обогащение claim → external_metadata обновлено |
| `test_enrich_claim_not_found` | Claim не существует → warning |
| `test_enrich_claim_invalid_uuid` | Некорректный UUID → warning |

### InternationalSearchService (3 теста)

| Тест | Сценарий |
|------|----------|
| `test_international_search_us_only` | Поиск по US → результаты от USPTO |
| `test_international_search_deduplication` | Один патент из 2 источников → дедупликация |
| `test_international_search_unauthorized` | Без токена → 401 |

### Вспомогательные (5 тестов)

| Тест | Что проверяет |
|------|--------------|
| `test_default_sources_us` | US → [USPTO, PATENTSVIEW] |
| `test_default_sources_ep` | EP → [EPO_OPS] |
| `test_default_sources_wo` | WO → [WIPO_PCT] |
| `test_default_sources_fallback` | JP → [USPTO] (default) |
| `test_international_search_unauthorized` | Без auth → 401 |

---

## Мокирование внешних API

Все HTTP-запросы к USPTO, EPO, WIPO, PatentsView мокируются через **respx**:

```python
@respx.mock
async def test_something():
    # Мокируем GET к USPTO
    respx.get("https://data.uspto.gov/api/v1/patent/grants").mock(
        return_value=Response(200, json={"results": [...], "total": 1})
    )
    
    # Мокируем POST к Applications Search
    respx.post("https://data.uspto.gov/api/v1/patent/applications/search").mock(
        return_value=Response(200, json={"results": [...], "total": 1})
    )
    
    # Тест вызывает код, который делает реальные запросы
    client = UsptoPatentClient(api_key="test-key")
    result = await client.fetch_patent_by_number("1234567", country_code="US")
    
    assert result.success is True
```

**Важно:** Декоратор `@respx.mock` обязателен — без него моки не активируются и запросы уйдут в реальный интернет.

---

## Написание новых тестов

### Шаблон для тестирования сервиса

```python
@respx.mock
async def test_my_service_action(db_session: AsyncSession):
    # 1. Моки внешних API
    respx.get("https://data.uspto.gov/...").mock(
        return_value=Response(200, json={...})
    )
    
    # 2. Подготовка данных в БД
    user = await make_user(role="issuer")
    claim = IpClaim(issuer_user_id=user.id, patent_number="123", ...)
    db_session.add(claim)
    await db_session.flush()
    
    # 3. Вызов сервиса
    service = MyService(db_session)
    result = await service.do_something(claim.id)
    
    # 4. Asserts
    assert result.success is True
    
    # 5. Проверка БД
    stmt = select(IpClaim).where(IpClaim.id == claim.id)
    updated = (await db_session.execute(stmt)).scalar_one()
    assert updated.title == "New Title"
```

### Шаблон для тестирования API-эндпоинта

```python
@respx.mock
async def test_my_endpoint(client, make_user, auth_headers, db_session):
    # 1. Моки внешних API
    respx.get("https://data.uspto.gov/...").mock(...)
    
    # 2. Создание пользователя
    user = await make_user(role="user")
    headers = auth_headers(user)
    
    # 3. HTTP-запрос
    resp = await client.post(
        "/api/v1/patents/precheck/international",
        headers=headers,
        json={"patent_number": "123", "country_code": "US"},
    )
    
    # 4. Asserts
    assert resp.status_code == 200
    data = resp.json()
    assert "exists" in data
```
