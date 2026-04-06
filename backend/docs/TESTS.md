# Тестирование — Руководство

> Версия: v3.1 (06.04.2026 — 160 passing tests)

## Обзор

Проект использует **pytest + pytest-asyncio + respx** для тестирования backend-кода. Все тесты — асинхронные, работают с in-memory SQLite через SQLAlchemy Async.

| Инструмент | Назначение |
|------------|-----------|
| **pytest** | Тест-раннер, фикстуры, assertions |
| **pytest-asyncio** | Запуск async-тестов (`async def test_...`) |
| **respx** | Мокирование внешних HTTP-запросов (USPTO, EPO, WIPO, PatentsView) |
| **httpx.AsyncClient + ASGITransport** | Тестирование API-эндпоинтов без запуска сервера |
| **aiosqlite** | In-memory SQLite для изоляции тестов |

## Статистика тестов (v3.1)

- **Всего тестов:** 160
- **Passing:** 160 (100%)
- **Failing:** 0
- **Warnings:** 0
- **Время выполнения:** ~29 секунд

## Запуск тестов

```bash
# Все тесты
python -m pytest

# Конкретный файл
python -m pytest tests/test_auth.py -v

# Один тест
python -m pytest tests/test_auth.py::test_register_investor_with_wallet -v

# Тесты с отчётом о покрытии (нужен pytest-cov)
python -m pytest --cov=app --cov-report=term-missing

# Только сервисные тесты (без API)
python -m pytest tests/test_patent_clients.py tests/services/ -v
```

## Структура тестов

```
tests/
├── conftest.py                    # Общие фикстуры (db, user, auth_headers, mock Redis)
├── test_auth.py                   # 18 тестов — Auth endpoints (wallet registration, login, OTP)
├── test_users.py                  # 10 тестов — User endpoints (profile, verification)
├── test_ip_claims.py              # 13 тестов — IP Claims (list, get, docs, review, audit)
├── test_audit.py                  # 10 тестов — Audit logging
├── test_integration_flows.py      # 6 тестов — End-to-end сценарии
├── test_main.py                   # 2 теста — Health check, ping
├── test_security.py               # 20 тестов — JWT, password hashing, token revocation
├── test_patent_clients.py         # 31 тест — Внешние API-клиенты (USPTO, EPO, WIPO, PatentsView)
├── test_ip_intel.py               # 19 тестов — IP Intel сервисы (precheck, search, enrich)
├── test_patent_precheck.py        # 4 теста — Patent precheck endpoints
└── services/
    ├── test_file_storage.py       # 13 тестов — File storage (verification + IP claims)
    ├── test_otp_email.py          # 7 тестов — OTP delivery через email
    └── test_otp_sender.py         # 7 тестов — Email/SMS отправка
```

## Общие фикстуры (conftest.py)

### `db_session` — AsyncSession
In-memory SQLite сессия. Каждый тест работает в транзакции, которая откатывается после теста. Данные не сохраняются между тестами.

```python
async def test_something(db_session: AsyncSession):
    user = User(email="test@example.com")
    db_session.add(user)
    await db_session.flush()
```

### `make_user` — Фабрика пользователей
Создаёт пользователя в БД с нужными ролью и статусом.

```python
async def test_admin_action(make_user, db_session):
    admin = await make_user(role="admin", status="active")
    investor = await make_user(role="investor", email="custom@example.com")
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
    resp = await client.post(
        "/api/v1/auth/register",
        json={"email": "test@example.com", "solana_wallet_address": "7xKX..."},
    )
    assert resp.status_code == 201
```

### `mock_redis_client` — Mock Redis
Автоматически мокирует Redis для каждого теста (autouse fixture).

```python
async def test_otp_flow(mock_redis_client):
    mock_redis_client.get = AsyncMock(return_value="...")
    # OTP verification logic
```

---

## Ключевые изменения в тестах v3.1 (06.04.2026)

### 1. Wallet-First Auth (solana_wallet_address required)

**Регистрация** теперь требует `email` + `solana_wallet_address`. Пароль не нужен.

```python
# Было (v2.x):
resp = await client.post("/api/v1/auth/register", json={
    "email": "test@example.com", "password": "Secret123!", "role": "user"
})

# Стало (v3.1):
resp = await client.post("/api/v1/auth/register", json={
    "email": "test@example.com", "solana_wallet_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRrJosgAsU"
})
```

### 2. Удалён POST `/ip-claims`

Создание IP claim теперь через `POST /auth/submit-patent` (с OTP flow). В тестах claim'ы создаются напрямую в БД:

```python
# Helper для тестов:
async def _create_claim_in_db(db_session, user_id, patent_number="US1234567"):
    claim = IpClaim(
        issuer_user_id=user_id,
        patent_number=patent_number,
        patent_title="Test Patent",
        claimed_owner_name="Acme Corp",
        status=IpClaimStatus.submitted.value,
    )
    db_session.add(claim)
    await db_session.flush()
    await db_session.refresh(claim)
    return claim
```

### 3. Удалён `/users/verification/review/{id}`

Admin review верификации больше не доступен через REST endpoint. Тесты на review удалены, добавлены тесты на состояния (rejected → resubmit, approved → cannot resubmit).

### 4. AuditLog в IpClaimService.review()

Добавлен `AuditService.write` в `IpClaimService.review()` — все тесты на audit теперь проходят.

### 5. Роли

Остались только: `investor`, `issuer`, `admin`.

| Роль | Описание |
|------|----------|
| `investor` | Базовая роль, может просматривать claims, подать патент → upgrade |
| `issuer` | После OTP upgrade, может загружать KYC документы, создавать claims |
| `admin` | Полный доступ: review claims/users, управление пользователями |

Удалены: `user`, `compliance_officer`.

---

## Мокирование внешних API

Все HTTP-запросы к USPTO, EPO, WIPO, PatentsView мокируются через **respx**:

```python
@respx.mock
async def test_something():
    respx.get("https://data.uspto.gov/api/v1/patent/grants").mock(
        return_value=Response(200, json={"results": [...], "total": 1})
    )

    client = UsptoPatentClient(api_key="test-key")
    result = await client.fetch_patent_by_number("1234567", country_code="US")
    assert result.success is True
```

**Важно:** Декоратор `@respx.mock` обязателен — без него моки не активируются.

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
```

### Шаблон для тестирования API-эндпоинта

```python
async def test_my_endpoint(client, make_user, auth_headers, db_session):
    # 1. Создание пользователя
    user = await make_user(role="investor")
    headers = auth_headers(user)

    # 2. HTTP-запрос
    resp = await client.post(
        "/api/v1/auth/register",
        headers=headers,
        json={"email": "test@example.com", "solana_wallet_address": "7xKX..."},
    )

    # 3. Asserts
    assert resp.status_code == 201
```

### Тестирование OTP flow

```python
async def test_otp_verify(client, mock_redis_client):
    from app.services.otp_service import _hash_otp
    import json, time

    code = "123456"
    key = f"otp:register:test@example.com"
    payload = json.dumps({
        "otp_hash": _hash_otp(code),
        "attempts_left": 5,
        "expires_at": time.time() + 300,
    })
    mock_redis_client.get = AsyncMock(return_value=payload)

    resp = await client.post("/api/v1/auth/otp-verify", json={
        "identifier": "test@example.com", "code": code, "purpose": "register"
    })
    assert resp.status_code == 200
    assert resp.json()["verified"] is True
```
