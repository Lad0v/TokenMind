# Архитектура проекта FastAPI Boilerplate

## Общая информация

**Тип проекта:** Монолитный FastAPI backend для платформы управления интеллектуальной собственностью (IP) и KYC верификации.

**Версия:** v2.8 (Simplified Roles, 05.04.2026)

**Технологический стек:**
- **Backend:** Python 3.12, FastAPI 0.115.0
- **База данных:** SQLAlchemy 2.0 (Async), Alembic для миграций
- **PostgreSQL:** asyncpg 0.29.0 (production), aiosqlite (development)
- **Аутентификация:** JWT (python-jose), PBKDF2 хэширование паролей
- **Кэширование:** Redis (опционально), Database cache
- **Внешние API:** USPTO, EPO OPS, WIPO PATENTSCOPE, PatentsView
- **HTTP клиенты:** httpx, aiohttp
- **Retry логика:** tenacity
- **Хранилище:** MinIO/S3 (aiobotocore), local fallback
- **Тестирование:** pytest, pytest-asyncio, pytest-cov, respx

**Структура:** Модульный монолит с чистым разделением слоев (layers).

---

## Архитектурные слои

```
┌─────────────────────────────────────────────────────────┐
│                    API Layer (Routes)                    │
│  app/api/v1/endpoints/*.py - HTTP handlers               │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                   Service Layer                          │
│  app/services/*.py - Business logic                      │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                 Repository Layer                         │
│  (Прямой доступ через SQLAlchemy в сервисах)             │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                  Database Layer                          │
│  app/core/database.py - SQLAlchemy AsyncSession          │
│  app/models/*.py - ORM модели                            │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              External Integrations Layer                 │
│  app/integrations/patent_clients.py - API клиенты        │
└─────────────────────────────────────────────────────────┘
```

---

## Структура директорий

```
D:\IpClaim\
├── main.py                          # Точка входа (базовый FastAPI app)
├── requirements.txt                 # Python зависимости
├── docker-compose.yml               # Docker orchestration
├── docker-compose.override.yml      # Docker override (MinIO, volumes)
├── Dockerfile                       # Container image
├── alembic.ini                      # Alembic конфигурация
├── Makefile                         # Автоматизация команд (make test, make lint, etc.)
├── pytest.ini                       # Pytest конфигурация
├── .env.example                     # Переменные окружения (шаблон)
├── .env                             # Переменные окружения (локальные, не в git)
├── to_change.md                     # План изменений для будущих версий
├── IP_INTEL_MODULE.md               # Документация IP Intel модуля
├── general_docs.txt                 # Общее ТЗ и документация проекта
│
├── docs/                            # Дополнительная документация
│   ├── API_FOR_FRONTEND.md          # API-справочник для фронтенд-разработчиков
│   └── TESTS.md                     # Руководство по тестированию
│
└── app/
    ├── __init__.py
    ├── main.py                      # FastAPI приложение (stub — дублирует root main.py, планируется удаление)
    │
    ├── core/                        # Ядро приложения
    │   ├── config.py                # Pydantic settings (.env)
    │   ├── database.py              # SQLAlchemy engine, session, Base
    │   └── security.py              # JWT, auth guards, token management
    │
    ├── api/v1/                      # API Routes
    │   ├── router.py                # Агрегатор всех v1 роутеров
    │   └── endpoints/
    │       ├── auth.py              # /auth/* (register, login, OTP, logout)
    │       ├── users.py             # /users/* (profile, verification)
    │       ├── patents.py           # /ip/* (patent precheck)
    │       ├── ip_claims.py         # /ip-claims/* (claims management)
    │       ├── ip_intel.py          # /patents/* (IP Intelligence module)
    │       ├── admin_users.py       # /api/v1/users/* (admin CRUD)
    │       └── admin_patents.py     # /api/v1/admin/patents/* (admin patent CRUD)
    │
    ├── models/                      # SQLAlchemy ORM модели
    │   ├── user.py                  # User, Profile, KYCCase, SanctionCheck, WalletLink, OTPCode, VerificationCase
    │   ├── patent.py                # Patent, PatentDocument, PatentReview
    │   ├── ip_claim.py              # IpClaim, IpDocument, IpReview, TokenRevocation
    │   ├── ip_intel.py              # PatentCache, PatentSearchCache (кэш модуль)
    │   ├── analytics.py             # UserMetricsDaily, PatentMetricsDaily, KYCFunnelStats
    │   └── common.py                # AuditLog, WebhookEvent
    │
    ├── services/                    # Бизнес-логика
    │   ├── auth_service.py          # Token revocation, cleanup
    │   ├── user_service.py          # User CRUD, password hashing, profiles, admin operations, Wallet Link CRUD
    │   ├── otp_service.py           # OTP generation/verification (Redis-based)
    │   ├── otp_sender.py            # Email (SMTP) и SMS (STUB) delivery
    │   ├── file_storage.py          # MinIO/S3 upload + local fallback
    │   ├── patent_service.py        # Patent precheck (delegates to IP Intel or MVP adapter)
    │   ├── admin_patent_service.py  # Admin patent CRUD (list, detail, status change)
    │   ├── ip_claim_service.py      # IP claims CRUD, document registration, reviews
    │   ├── ip_intel_service.py      # IP Intelligence services (main orchestration)
    │   └── audit_service.py         # Audit logging
    │
    ├── schemas/                     # Pydantic модели (DTO)
    │   ├── auth.py                  # Auth request/response schemas
    │   ├── user.py                  # User schemas
    │   ├── ip_claim.py              # IP claim schemas
    │   ├── ip_intel.py              # IP Intelligence DTOs (NormalizedPatentRecord, etc.)
    │   └── admin.py                 # Admin DTOs (UserAdminResponse, PatentAdminResponse, etc.)
    │
    ├── integrations/                # Внешние API клиенты
    │   └── patent_clients.py        # USPTO, PatentsView, EPO OPS, WIPO клиенты
    │
    └── repositories/                # ❌ УДАЛЕНО в v2.6 — паттерн Repository не используется (прямой доступ через SQLAlchemy в сервисах)
```

---

## База данных

### Подключение

```python
# DATABASE_URL форматы:
# SQLite:  sqlite+aiosqlite:///./app.db
# PostgreSQL: postgresql+asyncpg://user:pass@localhost/dbname

# SQLAlchemy 2.0 async engine
engine = create_async_engine(DATABASE_URL, echo=settings.DEBUG)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
```

### Основные модели

#### User Domain (app/models/user.py)

**User** - Основная модель пользователя
- `id: UUID` (PK)
- `email: str` (unique, indexed, nullable — для wallet-only пользователей)
- `password_hash: str` (nullable — инвесторы без пароля)
- `auth_provider_ref: str` (nullable - ссылка на внешний auth-провайдер, v2.6+)
- `role: UserRole` (investor, issuer, admin)
- `status: UserStatus` (pending_otp, active, suspended, blocked, rejected)
- Relationships: profile, kyc_cases, sanctions_checks, patents, ip_claims, wallet_links, otp_codes, verification_cases

**Profile** - Профиль пользователя
- `user_id: UUID` (PK, FK -> users.id)
- `full_name`, `country`, `organization_name`, `preferred_language`

**KYCCase** - KYC верификация
- `id: UUID` (PK)
- `user_id: UUID` (FK)
- `provider: str` (внешний KYC провайдер)
- `provider_case_id: str`
- `status: KYCCaseStatus`
- `risk_level: KYCRiskLevel`

**SanctionCheck** - Проверка санкций (v2.6+)
- `id: UUID` (PK)
- `user_id: UUID` (FK)
- `status: SanctionCheckStatus` (pending, clear, matches_found, manual_review, failed)
- `flags: JSON` (найденные совпадения)
- `checked_at`

**WalletLink** - Привязка криптокошелька
- `id: UUID` (PK)
- `user_id`, `wallet_address`, `network`, `is_primary`
- UniqueConstraint: (wallet_address, network)

**OTPCode** - Одноразовые коды
- `id: UUID` (PK)
- `user_id`, `code: str(6)`, `purpose`, `is_used`, `expires_at`

**VerificationCase** - Верификация для patent submitters
- `id: UUID` (PK)
- `user_id`, `patent_name`, `patent_address`, `user_address`
- `id_document_url`, `selfie_url`, `status`, `reviewer_notes`

#### Patent Domain (app/models/patent.py)

**Patent** - Патент
- `id: UUID` (PK)
- `owner_user_id: UUID` (FK -> users.id)
- `patent_number`, `jurisdiction`, `title`, `abstract`
- `status: PatentStatus` (draft, submitted, prechecked, under_review, approved, rejected, archived)

**PatentDocument** - Документы патента
- `id: UUID` (PK)
- `patent_id` (FK), `document_type`, `storage_key`, `created_by_user_id`

**PatentReview** - Рецензии патента
- `id: UUID` (PK)
- `patent_id` (FK), `reviewer_user_id` (FK)
- `decision: ReviewDecision`, `notes`, `reviewed_at`

#### IP Claim Domain (app/models/ip_claim.py)

**IpClaim** - Заявление на право IP
- `id: UUID` (PK)
- `issuer_user_id: UUID` (FK)
- `patent_number`, `patent_title`, `claimed_owner_name`, `description`, `jurisdiction`
- `status: IpClaimStatus` (draft, submitted, prechecked, awaiting_kyc, under_review, approved, rejected)
- `prechecked: bool`, `precheck_status`, `source_id`, `checked_at`
- `patent_metadata: JSON`, `external_metadata: JSON` (модуль ip_intel)

**IpDocument** - Документы IP claim
- `id: UUID` (PK)
- `ip_claim_id` (FK), `file_url`, `doc_type`, `created_by_user_id`

**IpReview** - Рецензия IP claim
- `id: UUID` (PK)
- `ip_claim_id` (FK), `reviewer_id` (FK)
- `decision: IpReviewDecision` (approve, reject, request_more_data), `notes`

**TokenRevocation** - Отозванные токены
- `jti: str` (PK)
- `token_type`, `expires_at`, `revoked_at`

#### IP Intelligence Cache Domain (app/models/ip_intel.py)

**PatentCache** - Кэш патентных данных
- `id: UUID` (PK)
- `source: PatentCacheSource` (USPTO, PATENTSVIEW, EPO_OPS, WIPO_PCT)
- `source_id`, `country_code`, `patent_number`, `kind_code`
- Нормализованные поля: `title`, `abstract`, `filing_date`, `publication_date`, `grant_date`
- `patent_status: str` (granted/pending/expired/revoked/unknown) — статус самого патента
- JSON поля: `assignees`, `inventors`, `cpc_classes`, `uspc_classes`, `ipc_classes`, `geo_data`, `family_ids`
- `raw_data: JSON` (сырые данные от источника)
- `cache_status: PatentCacheStatus` (valid/expired/error) — статус записи кэша
- `cached_at`, `expires_at`, `ip_claim_id` (FK -> ip_claims.id)

**PatentSearchCache** - Кэш поисковых запросов
- `id: UUID` (PK)
- `query_hash: str` (indexed), `query_text`
- `countries`, `date_from`, `date_to`
- `results: JSON`, `total_count`, `sources_queried`
- `cached_at`, `expires_at`

#### Common (app/models/common.py)

**AuditLog** - Аудит действий
- `id: UUID` (PK)
- `actor_id` (FK -> users.id, nullable)
- `action: str`, `entity_type: str`, `entity_id: str`
- `payload: JSON` (без PII данных)
- `created_at`

**WebhookEvent** - Входящие вебхуки
- `id: UUID` (PK)
- `source: str`, `external_id: str`
- `status: WebhookEventStatus` (received, processed, failed, dead_letter)
- `payload: JSON`, `created_at`, `updated_at`

#### Analytics (app/models/analytics.py)

**UserMetricsDaily** - Ежедневные метрики пользователей
- `date: Date` (PK)
- `total_users`, `new_users`, `active_users`, `kyc_started`, `kyc_approved`

**PatentMetricsDaily** - Ежедневные метрики патентов
- `date: Date` (PK)
- `total_patents`, `new_patents`, `patents_under_review`, `patents_approved`, `patents_rejected`

**KYCFunnelStats** - Статистика KYC воронки
- Composite PK: (period_start, period_end, step_name)
- `step_name: KYCFunnelStep`, `users_count`

---

## API Endpoints

### Base URL: `/api/v1`

#### Auth (`/auth`)
```
POST   /api/v1/auth/register          # Регистрация (OTP flow для issuer)
POST   /api/v1/auth/register/wallet   # Регистрация только через кошелёк (investor, без OTP)
POST   /api/v1/auth/otp-send          # Отправка OTP (Redis-based, email/SMS)
POST   /api/v1/auth/otp-verify        # Верификация OTP + verified_token (JWT, 10 мин)
POST   /api/v1/auth/login             # Login (email + password)
POST   /api/v1/auth/refresh           # Refresh access token
DELETE /api/v1/auth/logout            # Logout (revoke refresh token)
PUT    /api/v1/auth/password-reset    # Сброс пароля
GET    /api/v1/auth/me                # Получить текущего пользователя
```

#### Users (`/users`)

**Profile & Verification** (реализовано):
```
GET    /api/v1/users/profile                    # Получить мой профиль
PUT    /api/v1/users/profile                    # Обновить мой профиль
POST   /api/v1/users/verification/precheck      # Получить данные патента для верификации (NEW v2.5)
POST   /api/v1/users/verification/documents     # Загрузить документы верификации (ID, selfie, video)
GET    /api/v1/users/verification/status        # Проверить статус верификации
POST   /api/v1/users/verification/review/{id}   # Рецензия верификации (admin)
```

**Wallet Link** (реализовано v2.5):
```
POST   /api/v1/users/wallets                    # Добавить кошелек
GET    /api/v1/users/wallets                    # Список кошельков пользователя
GET    /api/v1/users/wallets/primary            # Основной кошелек (Solana)
DELETE /api/v1/users/wallets/{wallet_id}        # Удалить кошелек (нельзя удалить primary — 403)
```

> **Wallet Immutability:** Primary wallet (основной кошелёк) нельзя удалить (возвращается 403) или изменить.
> Это гарантирует неизменность идентифика пользователя, привязанного к кошельку.

**Account & Upgrade** (v2.7):
```
POST   /api/v1/users/upgrade-to-issuer          # Upgrade investor → issuer (OTP required)
DELETE /api/v1/users/account                    # Удалить свой аккаунт (soft-delete)
```

**Admin CRUD** (✅ Реализовано v2):
```
GET    /api/v1/users                  # Список пользователей (admin, пагинация, фильтры, поиск)
GET    /api/v1/users/{user_id}        # Получить пользователя (детально с KYC, wallet, verification)
PUT    /api/v1/users/{user_id}        # Обновить пользователя (профиль, роль — с audit)
PUT    /api/v1/users/{user_id}/status # Изменить статус (с валидацией переходов + audit)
DELETE /api/v1/users/{user_id}        # Удалить пользователя (soft-delete, status=blocked)
```

#### Admin Patents (`/admin/patents`) (✅ Реализовано v2):
```
GET    /api/v1/admin/patents                   # Список патентов (admin)
GET    /api/v1/admin/patents/{patent_id}       # Получить патент (детально)
PUT    /api/v1/admin/patents/{patent_id}/status # Изменить статус (с audit)
```

#### IP Check (`/ip`)
```
POST   /api/v1/ip/check              # Создать IP claim (проверка на дубликат)
POST   /api/v1/ip/precheck           # Precheck патента (MVP adapter или IP Intel)
```

#### IP Claims (`/ip-claims`)
```
POST   /api/v1/ip-claims                     # Создать IP claim
GET    /api/v1/ip-claims                     # Список claims (фильтр по статусу)
GET    /api/v1/ip-claims/{claim_id}          # Получить claim
POST   /api/v1/ip-claims/{claim_id}/review   # Рецензия на claim
POST   /api/v1/ip-claims/{claim_id}/documents # Загрузить документ
```

#### IP Intelligence (`/patents`)
```
POST   /api/v1/patents/precheck/international           # Проверка патента (международная)
POST   /api/v1/patents/search/international              # Международный поиск
POST   /api/v1/patents/ip-claims/{id}/enrich/international # Обогащение IP claim
GET    /api/v1/patents/health                             # Health check модуля
```

#### Utils
```
GET    /api/v1/ping                    # Ping/pong
GET    /                               # Status + version
GET    /health                         # Health check
```

---

## Authentication & Authorization

### JWT Token Flow

1. **Access Token** (30 мин по умолчанию)
   - Тип: `access`
   - Используется для авторизации запросов через `Authorization: Bearer <token>`
   - Payload: `sub` (user.id UUID или email для wallet-only), `type`, `exp`, `iat`, `jti`

2. **Refresh Token** (7 дней по умолчанию)
   - Тип: `refresh`
   - Используется для получения нового access token
   - Хранится в таблице `token_revocations` при logout

3. **OTP Token** (10 мин)
   - Тип: `otp`
   - Используется для верификации OTP

4. **Password Reset Token** (30 мин)
   - Тип: `password_reset`

### Password Hashing

```python
# PBKDF2-HMAC-SHA256
# Формат: pbkdf2_sha256$iterations$salt$key_hex
iterations = 260,000
```

### Role-Based Access Control

**Роли:**
- `investor` — инвестор (по умолчанию, может upgrade до issuer через /users/upgrade-to-issuer)
- `issuer` — эмитент (создаёт IP claims, подаёт патенты)
- `admin` — администратор (все админ-действия, включая review claim'ов и патентов)

> **Примечание (v2.8):** Роль `compliance_officer` была объединена с `admin`. Все действия, ранее доступные compliance_officer, теперь выполняются ролью `admin`.

**Guard:**
```python
@router.get("/admin-only", dependencies=[Depends(require_roles("admin"))])
```

### Token Revocation

При logout refresh token добавляется в таблицу `token_revocations` с `jti` (JWT ID).
При каждом запросе проверяется, не отозван ли токен.

---

## Business Logic

### User Registration Flow

#### Для Issuer (email/password + OTP):
```
1. POST /auth/register (email, password, role=issuer, legal_name, country)
   → Создается User со статусом pending_otp
   → Создается Profile
   → Генерируется OTP код
   → Возвращается user_id

2. POST /auth/otp/send (email) - опционально повторная отправка
   → Генерируется новый OTP

3. POST /auth/otp/verify (email, code)
   → Проверяется OTP код
   → User статус меняется на active
   → Создаётся VerificationCase
   → Возвращаются access_token + refresh_token
```

#### Для Investor (wallet-only, без OTP):
```
1. POST /auth/register/wallet (wallet_address, network, legal_name)
   → Создаётся User со статусом active (без OTP, email nullable)
   → Роль: investor
   → Создаётся WalletLink (primary)
   → Возвращаются access_token + refresh_token
```

#### Для Investor (email/password, без OTP):
```
1. POST /auth/register (email, password, role=investor, legal_name, country)
   → Создаётся User со статусом active (без OTP)
   → Роль: investor
   → Возвращаются access_token + refresh_token
```

#### Investor to Issuer Upgrade:
```
1. POST /users/upgrade-to-issuer (требует авторизацию, role=investor)
   → Генерируется OTP код на email пользователя
   → User получает verified_token (JWT, 10 мин)

2. POST /auth/otp/verify (email, code, verified_token)
   → Проверяется OTP код
   → Роль меняется с investor на issuer
   → Создаётся VerificationCase
   → Возвращаются обновлённые access_token + refresh_token
```

### IP Claim Flow

```
1. User делает precheck патента: POST /ip/precheck
   → PatentService.precheck() (MVP deterministic adapter)
   → Возвращает PatentPrecheckResponse

2. User создает IP claim: POST /ip-claims
   → IpClaimService.create()
   → Статус: submitted

3. Пользователь загружает документы: POST /ip-claims/{id}/documents
   → IpClaimService.upload_document()
   → Файлы сохраняются в uploads/ip_claims/{claim_id}/

4. Admin делает review: POST /ip-claims/{id}/review
   → IpClaimService.review()
   → Статус меняется на approved/rejected/submitted
```

### IP Intelligence Module

**Архитектура модуля:**
```
┌─────────────────────────────────────────────────────────┐
│                   IP Intel Services                      │
│                                                          │
│  PatentStatusCheckService                               │
│  ├── Проверка кэша (PatentCache)                        │
│  ├── Запрос к внешнему API (USPTO/EPO/WIPO)            │
│  ├── Сохранение в кэш                                   │
│  └── Формирование NormalizedPatentRecord                │
│                                                          │
│  PatentDataEnrichmentService                            │
│  ├── Загрузка IP claim                                  │
│  ├── Обогащение из нескольких источников                │
│  ├── Обновление external_metadata                       │
│  └── Обновление полей claim                             │
│                                                          │
│  InternationalSearchService                             │
│  ├── Параллельные запросы ко всем источникам            │
│  ├── Агрегация результатов                              │
│  ├── Дедупликация по source_id + country_code           │
│  └── Пагинация                                          │
└─────────────────────────────────────────────────────────┘
```

**Внешние API клиенты:**

| Источник | BASE_URL | Auth | Rate Limit | Cache TTL |
|----------|----------|------|------------|-----------|
| USPTO | https://data.uspto.gov | API Key (X-API-Key) | 5 calls/sec | 72h |
| PatentsView | https://api.patentsview.org | Нет | 10 calls/sec | 48h |
| EPO OPS | https://ops.epo.org/rest-services | OAuth2 Bearer (TODO) | 5 calls/sec | 48h |
| WIPO PCT | https://patentscope.wipo.int/api | API Key | TBD | 48h |

**USPTO Client (v2.3) — стратегия поиска:**
1. `GET /api/v1/patent/grants?patentNumber={number}` — поиск среди выданных патентов
2. Если не найдено → `POST /api/v1/patent/applications/search` — поиск среди заявок
3. Для заявок дополнительно `GET /api/v1/patent/applications/{id}/continuity` — статус

**Retry/Backoff:**
```python
@retry(
    retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError))
          | retry_if_result(lambda r: r.status_code in {429, 500, 502, 503, 504}),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=30),
)
```

**Нормализация данных:**
Все внешние API приводятся к `NormalizedPatentRecord`:
```python
NormalizedPatentRecord(
    source="USPTO",                  # Источник
    source_id="1234567",             # ID в системе источника
    country_code="US",               # Код страны
    kind_code="B2",                  # Kind code
    title="...",                     # Название
    abstract="...",                  # Аннотация
    filing_date="2020-01-01",        # Дата подачи
    publication_date="2021-01-01",   # Дата публикации
    grant_date="2022-01-01",         # Дата выдачи
    status="granted",                # granted/pending/expired/revoked/unknown
    assignees=[{"name": "..."}],     # Правообладатели
    inventors=[{"name": "..."}],     # Изобретатели
    cpc_classes=["H04L..."],         # CPC классы
    citations_count=10,              # Цитирования
    geo_data={"assignee_countries": ["US", "EP"]},
    raw_data={...}                   # Сырые данные (для отладки)
)
```

---

## Configuration

### Environment Variables (.env)

```bash
# Basic
PROJECT_NAME=FastAPI Boilerplate
VERSION=0.1.0
DESCRIPTION=Монолитный FastAPI проект
DEBUG=False

# Database
DATABASE_URL=sqlite+aiosqlite:///./app.db

# JWT
SECRET_KEY=your-super-secret-key-change-in-production
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_MINUTES=10080  # 7 дней
EMAIL_VERIFY_TOKEN_EXPIRE_MINUTES=1440  # 24 часа
PASSWORD_RESET_TOKEN_EXPIRE_MINUTES=30
OTP_TOKEN_EXPIRE_MINUTES=10
REQUIRE_EMAIL_VERIFICATION=False

# CORS
ENABLE_CORS=True
ALLOWED_ORIGINS=["http://localhost:3000","http://localhost:8000"]

# IP Intelligence Module
ENABLE_IP_INTEL=True
USPTO_API_KEY=
EPO_OPS_CONSUMER_KEY=
EPO_OPS_CONSUMER_SECRET=
WIPO_API_KEY=

# Redis (optional)
ENABLE_REDIS=True
REDIS_URL=
REDIS_PASSWORD=

# Cache & Rate Limiting
PATENT_CACHE_TTL_HOURS=48
EXTERNAL_API_RATE_LIMIT=5.0
EXTERNAL_API_TIMEOUT=30.0
ENABLE_EXTERNAL_API_AUDIT=True

# Email OTP — Gmail SMTP (free). Enable 2FA in Google Account and create an App Password.
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASSWORD=xxxx_xxxx_xxxx_xxxx
SMTP_FROM_EMAIL=noreply@localhost

# SMS OTP — set to True to enable SMS delivery (requires provider integration)
ENABLE_SMS_OTP=False

# Generate with: python -c "import secrets; print(secrets.token_hex(32))"
OTP_HMAC_SECRET=replace-with-32-random-bytes

# MinIO / S3 Storage
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=ip-documents
MINIO_USE_SSL=False
```

---

## Dependency Injection

### FastAPI Dependencies

```python
# Database session
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

# Current user (from JWT token)
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    payload = decode_token(token, expected_type="access")
    # sub может быть user.id (UUID) или email (для wallet-only пользователей)
    user = await UserService.get_by_id_or_email(db, payload["sub"])
    # ... validation
    return user

# Role guard
def require_roles(*roles: str):
    async def _guard(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        return current_user
    return _guard
```

---

## Error Handling

### Global Exception Handlers (main.py)

Приложение регистрирует глобальные обработчики:

| Exception | Status Code | Response |
|-----------|-------------|----------|
| `RequestValidationError` | 422 | `{"error": "validation_error", "detail": [...]}` |
| `SQLAlchemyError` | 500 | `{"error": "database_error", "detail": "Internal database error occurred"}` |
| `Exception` (catch-all) | 500 | `{"error": "internal_server_error", "detail": "An unexpected error occurred"}` |

### HTTP Exception Patterns (в сервисах/эндпоинтах)

```python
# Not found
raise HTTPException(status_code=404, detail="Пользователь не найден")

# Unauthorized
raise HTTPException(status_code=401, detail="Неверный email или пароль")

# Forbidden
raise HTTPException(status_code=403, detail="Недостаточно прав")

# Bad request
raise HTTPException(status_code=400, detail="Email уже занят")

# Internal server error (external API failures)
raise HTTPException(status_code=400, detail=f"Patent precheck failed: {str(e)}")
```

---

## Caching Strategy

### Database Cache (PatentCache)

- **TTL:** 48 часов (настраивается через `PATENT_CACHE_TTL_HOURS`)
- **Key:** (source, source_id) - уникальный
- **Invalidation:** По expires_at, статус меняется на `expired`
- **Fields:** Нормализованные данные + raw_data для отладки

### Search Cache (PatentSearchCache)

- **TTL:** Меньше чем для单个 патентов (1-6 часов)
- **Key:** query_hash (SHA256 от запроса)
- **Fields:** query_text, countries, date range, results, total_count

### Redis (Optional)

- Если `ENABLE_REDIS=True` и `REDIS_URL` установлен
- Fallback на database cache если Redis недоступен

---

## Database Migrations (Alembic)

```bash
# Создание миграции
alembic revision --autogenerate -m "description"

# Применение миграций
alembic upgrade head

# Откат миграции
alembic downgrade -1
```

---

## Docker & Deployment

### Docker Compose

```yaml
services:
  api:
    build: .
    ports:
      - "8000:8000"
    env_file:
      - .env
    volumes:
      - .:/app
    command: uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Запуск

```bash
# Development
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Production
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4

# Docker
docker-compose up --build
```

### Lifespan Management

Приложение использует `lifespan` контекст для управления ресурсами:

**Startup:**
- Создание таблиц БД (только в DEBUG mode; в production — Alembic)
- Логирование запуска

**Shutdown:**
- Закрытие Redis connection pool (`close_redis()`)
- Dispose SQLAlchemy engine (`engine.dispose()`)

```python
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # Startup
    if settings.DEBUG:
        await init_db()
    yield
    # Shutdown
    await close_redis()
    await engine.dispose()
```

---

## Key Design Patterns

### 1. Layered Architecture
- **API Layer:** HTTP handlers, request validation (thin controllers)
- **Service Layer:** Business logic, orchestration, file storage
- **Repository Layer:** (Прямой доступ через SQLAlchemy в сервисах)
- **Integration Layer:** External API clients

### 2. Dependency Injection
- FastAPI `Depends()` для sessions, auth, services
- Конструкторы сервисов принимают `db: AsyncSession`
- Lazy imports в `security.py` для избежания циклических зависимостей

### 3. DTO Pattern
- **Pydantic schemas** для request/response validation
- **NormalizedPatentRecord** как canonical DTO для внешних API

### 4. Retry/Backoff
- Tenacity для внешних API вызовов
- Exponential backoff для 429 и 5xx ошибок

### 5. Audit Trail
- Все критические действия записываются в `audit_logs`
- Immutable records (только insert)
- Non-PII payload (без персональных данных)

### 6. File Storage Abstraction
- `file_storage.py` — централизованный сервис для сохранения документов
- **MinIO/S3 Integration** (v2.5): aiobotocore для async uploads
- **Automatic Fallback**: MinIO → local filesystem при ошибках
- **Testing Support**: base_dir параметр для локального тестирования
- Поддерживает verification documents (ID, selfie, video) и IP claim documents

### 7. OTP Architecture Split
- **New endpoints** (`/otp-send`, `/otp-verify`): Redis-based, HMAC-hashed codes, 5-min TTL
- **Legacy endpoints** (`/otp/send`, `/otp/verify`): SQLAlchemy-based, DB-stored codes, deprecated
- Legacy endpoints поддерживают обратную совместимость с `{"email": "..."}` форматом

---

## External API Integration

### Patent Clients Architecture

```python
BasePatentClient (Abstract)
├── UsptoPatentClient
├── PatentsViewClient
├── EpoOpsClient
└── WipoPatentscopeClient (partial implementation)

# Factory function
def create_patent_client(source: str) -> BasePatentClient:
    return {"USPTO": UsptoPatentClient, ...}[source]()
```

### BasePatentClient Features

- Retry with exponential backoff
- Rate limiting (semaphore + timing)
- Request ID generation
- Audit logging
- Response normalization

---

## Future Improvements (TODOs in code)

### Completed
1. ~~**Exception Handlers**~~ — Добавлены глобальные обработчики для validation, DB, general errors
2. ~~**Lifespan Management**~~ — Реализован startup/shutdown для Redis и DB engine
3. ~~**File Storage Abstraction**~~ — Вынесен в отдельный сервис `file_storage.py`
4. ~~**Circular Import Fix**~~ — Lazy imports в `security.py`
5. ~~**OTP Endpoint Split**~~ — Legacy endpoints помечены deprecated, новые Redis-based endpoints активны
6. ~~**Schema Consolidation**~~ — Удалены дубликаты PatentPrecheckRequest/Response
7. ~~**IP Intel Module**~~ — Реализованы PatentStatusCheckService, PatentDataEnrichmentService, InternationalSearchService
8. ~~**Patent Clients**~~ — UsptoPatentClient, PatentsViewClient реализованы; EpoOpsClient (OAuth2 TODO), WipoPatentscopeClient (partial)
9. ~~**S3/MinIO Integration**~~ — Полная интеграция v2.5 (aiobotocore, docker-compose, automatic fallback)
10. ~~**Wallet Link API**~~ — Полный CRUD v2.5 (add, list, get primary, delete)
11. ~~**Verification Precheck**~~ — Endpoint для получения данных патента перед верификацией v2.5
12. ~~**Login Response Refactor**~~ — Login возвращает только роль (to_change.md #7) v2.5
13. ~~**Test Suite**~~ — 171 тест, 100% passing, 0 warnings v2.5

### Remaining TODOs (из кода)
14. **EPO OAuth2:** Реализовать client credentials flow (`patent_clients.py:710`)
15. **WIPO Client:** Завершить реализацию WIPO клиента
16. **EPO OPS XML Parsing:** Детальный парсинг ответов (`patent_clients.py:771-839`)
17. **USPTO Response Formats:** Обработать различные форматы ответов (`patent_clients.py:338`)
18. **Audit Logging:** Подключить AuditService к external API вызовам (`patent_clients.py:148`)
19. **Upsert для PostgreSQL:** Оптимизировать PatentCache (`ip_intel_service.py:250`)
20. **Health Check Improvements:** Реализовать проверку API key/OAuth2 статуса (`ip_intel.py:244-247`)

### Planned (планируется на бэкенде)
21. **KYC Webhook Processing:** Входящий endpoint для webhook от KYC провайдера
22. **SMS OTP Provider:** Интеграция с Firebase Auth / MSG91 / Vonage (сейчас STUB)
23. **Monitoring:** Prometheus metrics, structured logging

---

## Testing

```bash
# Запуск тестов
pytest

# Async tests
pytest -v --asyncio-mode=auto
```

**Test Patterns:**
- pytest fixtures для db sessions
- Mock внешних API клиентов
- Integration tests для полного flow

---

## Code Conventions

### Naming
- **Models:** PascalCase (User, IpClaim, PatentCache)
- **Services:** PascalCase + "Service" suffix (UserService, PatentStatusCheckService)
- **Endpoints:** snake_case файлы (auth.py, ip_claims.py)
- **Schemas:** PascalCase + Request/Response suffix

### Imports
```python
# Standard library
import uuid
from datetime import datetime, timezone

# Third-party
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

# Application
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.auth import LoginRequest
from app.services.user_service import UserService
```

### Type Hints
- Все параметры и возвращаемые значения типизированы
- Использование `Mapped[]` для SQLAlchemy 2.0
- Optional для nullable полей

---

## Performance Considerations

1. **Async I/O:** Все database queries и external API calls асинхронные
2. **Connection Pooling:** SQLAlchemy engine управляет пулом соединений
3. **Caching:** Patent данные кэшируются на 48+ часов
4. **Pagination:** Все списки поддерживают pagination (skip/limit)
5. **Indexes:** Ключевые поля индексированы (email, status, patent_number)
6. **Rate Limiting:** Внешние API вызовы ограничены (5-10 calls/sec)

---

## OTP Delivery Architecture

### Overview

OTP система использует **единый Redis-based режим**:
- `generate_and_send_otp()`, `verify_otp()`
- Legacy SQLAlchemy-based OTP удалён (v2.4)

### Redis-based OTP Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    OTP Delivery Pipeline                         │
│                                                                  │
│  1. POST /api/v1/auth/otp-send                                  │
│     ├── _classify_identifier() → email | phone                   │
│     ├── _normalize_identifier() → lowercase (email) / strip (phone)│
│     ├── generate_otp() → secrets.randbelow(1_000_000)            │
│     ├── _hash_otp() → HMAC-SHA256                                │
│     └── redis.set(key, payload, ex=300)                          │
│                                                                  │
│  2. Dispatch Delivery                                            │
│     ├── email → send_email_otp() → SMTP (smtplib, STARTTLS)      │
│     └── phone → ENABLE_SMS_OTP=True → send_sms_otp()             │
│                ENABLE_SMS_OTP=False → warning log (dev mode)      │
│                                                                  │
│  3. POST /api/v1/auth/otp-verify                                 │
│     ├── redis.get(key) → payload                                 │
│     ├── hmac.compare_digest() → constant-time comparison         │
│     ├── attempts_left decrement on mismatch                      │
│     └── redis.delete(key) on success → generate verified_token   │
└─────────────────────────────────────────────────────────────────┘
```

### Redis Key Structure

```
Key: otp:{purpose}:{normalized_identifier}
TTL: 300 seconds (5 minutes)

Value (JSON):
{
  "otp_hash": "abc123...",           # HMAC-SHA256 hash
  "attempts_left": 5,                # Max verification attempts
  "expires_at": 1698765432.123       # Unix timestamp
}
```

### Error Mapping

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| INVALID_IDENTIFIER | 400 | Identifier format unrecognized |
| INVALID_PURPOSE | 400 | Purpose not in {register, login, password_reset} |
| SMS_NOT_CONFIGURED | 501 | SMS provider not configured (use email) |
| OTP_EXPIRED | 404 | OTP not found or expired |
| OTP_BLOCKED | 409 | Too many failed attempts |
| OTP_INVALID | 422 | Wrong OTP code |

### Delivery Providers

**Email (SMTP):**
- Provider: smtplib with STARTTLS
- Env vars: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
- Gmail: требует 2FA + App Password
- Subject: "IPChain OTP – {purpose}"
- Body: "Your verification code: {code}\nExpires in 5 minutes."

**SMS (STUB):**
- Status: Not implemented
- TODO: Firebase Auth / MSG91 / Vonage integration
- Raises: NotImplementedError

### Security Considerations

- OTP codes NEVER returned in API responses
- HMAC-SHA256 hashing prevents code exposure even if Redis is compromised
- Constant-time comparison (hmac.compare_digest) prevents timing attacks
- Rate limiting on resend: 3 attempts per 10 minutes
- Max 5 verification attempts per OTP
- OTP_HMAC_SECRET should be 32 random bytes (secrets.token_hex(32))

---

## Security

1. **Password Hashing:** PBKDF2-HMAC-SHA256, 260,000 iterations
2. **JWT:** Access tokens с коротким TTL (30 мин)
3. **Token Revocation:** Refresh tokens инвалидируются при logout
4. **Role Guards:** RBAC для чувствительных endpoints
5. **Audit Logging:** Все критические действия логируются
6. **Input Validation:** Pydantic для всех request/response
7. **SQL Injection:** SQLAlchemy parameterized queries
8. **CORS:** Настраиваемый, отключаемый
9. **OTP Security:**
   - HMAC-SHA256 hashing кодов (OTP_HMAC_SECRET)
   - Constant-time comparison (hmac.compare_digest)
   - Rate limiting на повторные отправки (3/10 мин)
   - Max 5 попыток верификации
   - OTP коды НИКОГДА не возвращаются в API ответах
   - Redis TTL 300 секунд

---

## Changelog

### v2.8 — 05.04.2026 (Simplified Roles)
- **Удалена роль `compliance_officer`:** остались только `investor`, `issuer`, `admin`
- **Role Merge:** Все действия `compliance_officer` (ревью claim'ов, патентов, верификаций) теперь выполняет роль `admin`
- **RBAC обновлён:** admin_users (admin only), admin_patents (admin only), verification review (admin only), claim review (admin only)

### v2.7 — 05.04.2026 (Wallet-Only Auth, Role Upgrade)
- **Удалена роль `user`:** остались только `investor`, `issuer`, `admin`
- **Wallet-Only Registration:** POST /auth/register/wallet — регистрация инвестора через кошелёк (без OTP, email nullable)
- **Investor to Issuer Upgrade:** POST /users/upgrade-to-issuer — upgrade роли через OTP верификацию
- **Delete Account:** DELETE /users/account — пользователь может удалить свой аккаунт (soft-delete)
- **JWT `sub` field:** теперь поддерживает user.id (UUID) и email форматы
- **Wallet Immutability:** primary wallet нельзя удалить (403) или изменить
- **Роли:**
  - `investor` — по умолчанию, wallet-only или email/password (без OTP), может upgrade до issuer
  - `issuer` — подача патентов и создание IP claims (требует email/password + OTP)
  - `admin` — полный доступ

### v2.5 — 05.04.2026 (MVP Ready, Wallet Link API, MinIO, to_change.md)
- **Login endpoint:** возвращает только роль (без токенов) — to_change.md #7
  - Refresh endpoint сохранён для обратной совместимости (LoginWithTokenResponse)
  - Тесты обновлены для создания токенов напрямую
- **Verification Precheck:** POST /users/verification/precheck (v2.5)
  - Получение данных патента из БД перед верификацией
  - Per to_change.md #19: patent DB → name/address → ID+video+address → manual review
- **Wallet Link API:** полный CRUD (v2.5)
  - POST/GET/DELETE /users/wallets, GET /users/wallets/primary
  - Интеграция при регистрации инвестора (wallet_address в RegisterRequest)
  - UserService: create_wallet_link, get_user_wallets, get_primary_wallet, delete_wallet
- **MinIO/S3 Integration:** полная интеграция (v2.5)
  - aiobotocore в requirements.txt, MinIO в docker-compose.yml
  - Automatic fallback: MinIO → local filesystem
  - Тесты file_storage исправлены (13 failing → 13 passing)
- **IP Check refactoring:** precheck удален из create flow (v2.5)
  - POST /ip/check возвращает только {status: "created"|"exists"|"pending"}
  - Per to_change.md #17-18
- **Тесты:** 171 тест, 100% passing, 0 warnings
  - Исправлены file_storage, auth, integration flow тесты
  - pytest.ini: filterwarnings для jose deprecation
  - conftest.py: удалён кастомный event_loop fixture
- **Документация:** обновлены все документы до v2.5

### v2.3 — 05.04.2026 (USPTO Integration, Тесты, Документация)
- **UsptoPatentClient** → USPTO Open Data Portal v2.3 (`data.uspto.gov`)
  - Grants + Applications fallback стратегия
  - Continuity endpoint для статуса заявок
  - Улучшенная нормализация (CPC/USPC/IPC, mixed assignees/inventors)
- **PatentCache model** — исправлен баг: `status` → `patent_status` + `cache_status`
- **IpIntelService** — корректный маппинг, Pydantic конвертация, ValueError для неподдерживаемых стран
- **Alembic migration 002** — переименование колонок
- **Тесты:** 50 тестов (31 patent_clients + 19 ip_intel)
- **Документация:** docs/TESTS.md, docs/API_FOR_FRONTEND.md

### v2.2 — 05.04.2026 (Admin CRUD)
- Admin User Management (CRUD, статус, роли, soft-delete)
- Admin Patent Management (просмотр, статус, аудит)
- Пагинация, поиск, joinedload

---

**Дата последнего обновления:** 2026-04-05
**Версия:** v2.7 (Wallet-Only Auth, Role Upgrade)
**Статус:** Production Ready
