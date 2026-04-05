# IP Claim — Платформа токенизации интеллектуальной собственности

Backend для платформы верификации правообладателей, токенизации IP-активов и маркетплейса с расчётами в Solana.

**Версия:** v2.3 · **Дата:** 05.04.2026

---

## Что реализовано

| Модуль | Статус |
|--------|--------|
| Identity & Access (регистрация, JWT, OTP, роли, login, refresh, logout) | ✅ |
| User Profile & Verification (профиль, загрузка документов ID + selfie, review) | ✅ |
| Admin User Management (CRUD, статус, роли, soft-delete, пагинация, поиск) | ✅ |
| Admin Patent Management (просмотр, статус, пагинация, фильтрация, аудит) | ✅ |
| IP Check & Precheck (проверка патента через USPTO v2.3 / PatentsView) | ✅ |
| IP Claims (CRUD заявок, документы, review workflow) | ✅ |
| IP Intelligence Module (кэш, обогащение, международный поиск, рекомендации) | ✅ |
| Audit Logging (audit_logs, webhook_events) | ✅ |
| Тесты (50 тестов: patent_clients + ip_intel) | ✅ |

**Не относится к бэкенду:** Solana integration, Marketplace, Tokenization, Dividend System — внешние блоки.

---

## Технологический стек

- **Python 3.12** · **FastAPI 0.115.0**
- **SQLAlchemy 2.0 Async** · **Alembic** · **PostgreSQL** (asyncpg) / **SQLite** (aiosqlite)
- **JWT** (python-jose) · **PBKDF2** хэширование (260 000 итераций)
- **Redis** (опционально, для OTP) · **Database cache** (обязательно)
- **Внешние API:** USPTO, EPO OPS, WIPO PATENTSCOPE, PatentsView
- **Retry:** tenacity (exponential backoff 2–30s)
- **Тесты:** pytest · pytest-asyncio · respx

---

## Структура проекта

```
app/
├── core/               # Config, database, security (JWT, auth guards)
├── api/v1/endpoints/   # HTTP handlers (auth, users, patents, ip_claims, ip_intel, admin)
├── services/           # Бизнес-логика (auth, user, otp, patent, ip_claim, ip_intel, audit)
├── integrations/       # Внешние API клиенты (USPTO, EPO, WIPO, PatentsView)
├── models/             # SQLAlchemy ORM (user, patent, ip_claim, ip_intel, analytics, common)
├── schemas/            # Pydantic DTO (auth, user, ip_claim, ip_intel, admin)
└── repositories/       # (Планируется)
```

---

## Быстрый старт

### 1. Настройка окружения

```bash
cp .env.example .env
# Отредактируй .env (минимум: DATABASE_URL, SECRET_KEY, OTP_HMAC_SECRET)
```

### 2. Запуск

```bash
# Development
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Docker
docker-compose up --build
```

### 3. Миграции

```bash
alembic upgrade head
```

### 4. Проверка

```
GET http://localhost:8000/           → {"project": "...", "version": "v2.3"}
GET http://localhost:8000/health     → Health check
GET http://localhost:8000/api/v1/ping → {"message": "pong"}
```

---

## API Overview

Base URL: `/api/v1`

### Auth (`/auth`)

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/register` | Регистрация (OTP flow для user/issuer, investor — сразу active) |
| POST | `/otp-send` | Отправка 6-значного OTP (Redis-based, email/SMS) |
| POST | `/otp-verify` | Верификация OTP → `verified_token` (JWT, 10 мин) |
| POST | `/login` | Login (email + password) → access + refresh token |
| POST | `/refresh` | Обновить access token |
| DELETE | `/logout` | Logout (revoke refresh token) |
| PUT | `/password-reset` | Сброс пароля |
| GET | `/me` | Текущий пользователь |

### Users (`/users`)

| Метод | Путь | Описание |
|-------|------|----------|
| GET/PUT | `/profile` | Мой профиль |
| POST | `/verification/documents` | Загрузить ID + selfie (multipart) |
| GET | `/verification/status` | Статус верификации |
| POST | `/verification/review/{id}` | Рецензия (admin/compliance_officer) |
| **Admin CRUD** | | |
| GET | `/users` | Список (пагинация, фильтры, поиск по email/name) |
| GET | `/users/{id}` | Детали (профиль, KYC, кошельки, верификация) |
| PUT | `/users/{id}` | Обновить (профиль, роль — с audit) |
| PUT | `/users/{id}/status` | Сменить статус (с валидацией переходов) |
| DELETE | `/users/{id}` | Soft-delete (status=blocked) |

### IP Claims (`/ip-claims`)

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/ip-claims` | Создать claim |
| GET | `/ip-claims` | Список (фильтр по статусу, пагинация) |
| GET | `/ip-claims/{id}` | Получить claim |
| POST | `/ip-claims/{id}/documents` | Загрузить документ (multipart) |
| POST | `/ip-claims/{id}/review` | Рецензия (admin/compliance_officer) |

### IP Intelligence (`/patents`)

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/patents/precheck/international` | Проверка патента (USPTO/EPO/WIPO) + рекомендация |
| POST | `/patents/search/international` | Международный поиск по ключевым словам |
| POST | `/patents/ip-claims/{id}/enrich/international` | Обогащение claim данными из внешних API |
| GET | `/patents/health` | Health check модуля (без авторизации) |

### Admin Patents (`/admin/patents`)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/admin/patents` | Список (фильтры, пагинация) |
| GET | `/admin/patents/{id}` | Детали (патент + профиль владельца) |
| PUT | `/admin/patents/{id}/status` | Сменить статус (с audit) |

---

## Роли и доступ

| Роль | Описание |
|------|----------|
| `user` | Обычный пользователь (patent submitter) |
| `issuer` | Правообладатель (создаёт IP claims) |
| `investor` | Инвестор (без OTP, сразу active) |
| `compliance_officer` | Офицер комплаенса (review claims) |
| `admin` | Администратор (полный доступ) |

---

## Тесты

```bash
# Все тесты
python -m pytest

# С покрытием
python -m pytest --cov=app --cov-report=term-missing

# Конкретный файл
python -m pytest tests/test_ip_intel.py -v
```

**50 тестов:** 31 patent_clients + 19 ip_intel (pytest + respx для моков внешних API).

---

## Переменные окружения

| Переменная | Описание |
|------------|----------|
| `DATABASE_URL` | `sqlite+aiosqlite:///./app.db` или `postgresql+asyncpg://...` |
| `SECRET_KEY` | Секрет для JWT (минимум 32 байта) |
| `JWT_ALGORITHM` | HS256 |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | 30 |
| `REFRESH_TOKEN_EXPIRE_MINUTES` | 10080 (7 дней) |
| `OTP_HMAC_SECRET` | Секрет для HMAC-SHA256 хэширования OTP (32 байта) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Email OTP (Gmail SMTP) |
| `USPTO_API_KEY` | API ключ для USPTO (data.uspto.gov) |
| `ENABLE_REDIS` | `True` для Redis-based OTP |
| `REDIS_URL` | `redis://localhost:6379/0` |
| `ENABLE_CORS` / `ALLOWED_ORIGINS` | CORS настройки |

---

## Архитектура

```
API Layer (Routes)
    ↓
Service Layer (Business Logic)
    ↓
Database Layer (SQLAlchemy Async ORM)
    ↓
External Integrations (USPTO, EPO, WIPO, PatentsView)
```

**Принципы:**
- Тонкие контроллеры: валидация через Pydantic, вызов сервисов, возврат response
- Зависимости через FastAPI `Depends()` (AsyncSession, current_user, role guards)
- Глобальные обработчики ошибок (422 validation, 500 database, catch-all)
- Soft-delete для пользователей (статус `blocked`, без физического удаления)
- Audit logging для всех admin операций

---

## Документация

| Файл | Описание |
|------|----------|
| [`docs/API_FOR_FRONTEND.md`](docs/API_FOR_FRONTEND.md) | Полная API-справочник для фронтенда |
| [`docs/TESTS.md`](docs/TESTS.md) | Руководство по тестированию |
| [`architecture.md`](architecture.md) | Подробная архитектура проекта |
| [`general_docs.txt`](general_docs.txt) | Техническое задание |

---

## Лицензия

Private — все права защищены.
