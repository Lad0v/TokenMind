# TokenMind

**TokenMind** — платформа для токенизации объектов интеллектуальной собственности на блокчейне Solana. Позволяет правообладателям верифицировать патенты, пройти KYC и выпустить токены, представляющие их IP-актив. Инвесторы могут покупать токены и получать фиксированные дивиденды.

---

## Содержание

- [Как это работает](#как-это-работает)
- [Стек технологий](#стек-технологий)
- [Структура проекта](#структура-проекта)
- [Быстрый старт](#быстрый-старт)
- [Переменные окружения](#переменные-окружения)
- [API](#api)
- [Тесты](#тесты)
- [Статус реализации](#статус-реализации)
- [Лицензия](#лицензия)

---

## Как это работает

```
Регистрация → KYC → Подача патента → Проверка USPTO → Admin Review → Токенизация (Solana) → Маркетплейс
```

**Правообладатель (Issuer):** регистрируется, проходит верификацию личности (KYC), подаёт номер патента, загружает подтверждающие документы. После ручного одобрения администратором — запускается токенизация актива в сети Solana.

**Инвестор:** просматривает листинги на маркетплейсе, покупает токены за SOL, получает фиксированные дивиденды с кошелька владельца патента.

**Администратор:** проверяет KYC и IP-заявки, управляет пользователями и патентами, ведёт полный audit trail.

> Токенизация, маркетплейс и дивиденды реализованы как внешние блоки (отдельная команда / Solana-интеграция).

---

## Стек технологий

| Слой | Технологии |
|---|---|
| **Backend** | Python, FastAPI 0.115.0, SQLAlchemy 2.0 Async, Alembic |
| **Database** | PostgreSQL (prod), SQLite (dev), Redis (OTP, кэш) |
| **Frontend** | Next.js 16.2.0 (App Router), TypeScript |
| **UI** | Radix UI, Tailwind CSS, Lucide React |
| **Forms** | React Hook Form |
| **Blockchain** | Solana (devnet → mainnet) |
| **Storage** | S3-compatible (локально — `uploads/`) |
| **Email** | SMTP + STARTTLS |
| **Infra** | Docker |

---

## Структура проекта

```
TokenMind/
├── backend/
│   └── app/
│       ├── core/               # Config, database, JWT, security
│       ├── api/v1/endpoints/   # HTTP handlers (auth, users, patents, ip_claims, admin)
│       ├── services/           # Бизнес-логика
│       ├── integrations/       # Клиенты USPTO, PatentsView, EPO, WIPO
│       ├── models/             # SQLAlchemy ORM модели
│       ├── schemas/            # Pydantic DTO
│       └── repositories/       # (запланировано)
│
├── frontend/
│   └── src/
│       ├── app/                # Next.js App Router
│       │   ├── page.tsx        # Главная (витрина)
│       │   ├── auth/           # login / register
│       │   ├── issuer/         # Кабинет правообладателя
│       │   ├── admin/          # Панель администратора
│       │   └── marketplace/    # Маркетплейс
│       ├── components/
│       │   ├── landing/        # hero, features, how-it-works, cta, footer
│       │   ├── ui/             # Radix-based примитивы
│       │   └── user/           # Профиль, аккаунт
│       ├── hooks/              # use-mobile, use-toast
│       └── lib/                # utils, helpers
│
├── .gitignore
└── LICENSE
```

---

## Быстрый старт

### Требования

- Python 3.11+
- Node.js 18+
- PostgreSQL или SQLite
- Redis

### Backend

```bash
cd backend

python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate

pip install -r requirements.txt

cp .env.example .env           # заполни переменные окружения

alembic upgrade head           # применить миграции

uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend

npm install

npm run dev
# http://localhost:3000
```

### Docker

```bash
docker compose up --build
```

---

## Переменные окружения

```env
# База данных
DATABASE_URL=postgresql+asyncpg://user:password@localhost/tokenmind

# JWT
SECRET_KEY=your-secret-key
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Redis / OTP
REDIS_URL=redis://localhost:6379
OTP_HMAC_SECRET=your-hmac-secret-32-chars

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=your-app-password

# USPTO
USPTO_API_KEY=your-uspto-api-key

# S3
S3_BUCKET=tokenmind-docs
S3_ENDPOINT_URL=https://s3.amazonaws.com
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
```

---

## API

Base URL: `/api/v1`

**Auth:** `POST /auth/register` · `/auth/login` · `/auth/otp-send` · `/auth/otp-verify` · `/auth/refresh` · `/auth/logout` · `/auth/password-reset`

**Users:** `GET/PUT /users/profile` · `/users/verification/documents` · `/users/verification/status` · Admin CRUD: `GET/PUT/DELETE /users/{id}` · `/users/{id}/status`

**IP Check:** `POST /ip/check` · `/ip/precheck`

**IP Claims:** `POST/GET /ip-claims` · `GET /ip-claims/{id}` · `POST /ip-claims/{id}/review` · `/ip-claims/{id}/documents`

**IP Intelligence:** `POST /patents/precheck/international` · `/patents/search/international` · `/patents/ip-claims/{id}/enrich/international`

**Admin Patents:** `GET /admin/patents` · `GET /admin/patents/{id}` · `PUT /admin/patents/{id}/status`

**Utils:** `GET /ping` · `GET /health`

> Полная документация: `backend/docs/API_FOR_FRONTEND.md`

---

## Тесты

```bash
cd backend
pytest          # 50 тестов: patent_clients + ip_intel
pytest -v       # с подробным выводом
```

Стек: `pytest` + `pytest-asyncio` + `respx` (мок внешних API).

---

## Статус реализации

### ✅ Готово (Backend MVP v2.3)
- Регистрация, JWT, OTP (Redis), роли, сессии
- Профили пользователей, загрузка документов, верификация
- Admin: управление пользователями и патентами (CRUD, пагинация, поиск, audit)
- IP Claims: подача, документы, review workflow
- USPTO v2.3: grants + applications fallback, continuity, retry, rate-limit
- IP Intelligence: кэш, обогащение данных, международный поиск, рекомендации
- Audit Logging, Webhook Events
- PostgreSQL/SQLite + Alembic (3 миграции)

### ✅ Готово (Frontend)
- Публичная витрина (landing, hero, features, how-it-works)
- Регистрация и вход
- Кабинет правообладателя (IP claims, загрузка патентов)
- Админ-панель (KYC review, IP reviews, audit)
- Маркетплейс (листинги)
- Тёмная тема, glass-морфизм, адаптивный дизайн

### ⚠️ В процессе
- KYC Provider webhook endpoint
- Wallet Link API (user ↔ Solana wallet)
- SMS OTP (Firebase Auth / MSG91 / Vonage)
- S3/MinIO интеграция
- Реальная JWT-авторизация на фронтенде (сейчас mock-сессия)

### ⛔ Внешние блоки (отдельная команда)
- Solana: mint, settlement, on-chain операции
- Marketplace: ордера, покупка токенов за SOL
- Tokenization: выпуск токенов, supply, treasury
- Dividend System: фиксированные выплаты, система предупреждений

---

## Лицензия

MIT — см. [LICENSE](LICENSE)
