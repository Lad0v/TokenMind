# API Reference — для Frontend-разработчиков

> **Версия: v3.1 (06.04.2026 — Solana Wallet Required, Simplified Registration)**
> Base URL: `http://localhost:8000/api/v1`
> Формат: JSON
> Авторизация: Bearer-токен в заголовве `Authorization`

---

## Быстрый старт

### Investor Flow (регистрация + логин через Solana wallet)

```
1. Регистрация          → POST /api/v1/auth/register          → email + solana_wallet_address
2. Логин кошельком      → POST /api/v1/auth/login/wallet      → wallet_address → access_token + refresh_token
3. Получить профиль     → GET  /api/v1/auth/me                → role: "investor"
```

### Patent Submission Flow (investor → issuer через OTP)

```
1. Подать патент         → POST /api/v1/auth/submit-patent         → email + phone → OTP отправлен
2. Получить OTP          → фронтенд получает otp_sent_to + submission_id
3. Подтвердить OTP       → POST /api/v1/auth/submit-patent/verify-otp → role: investor → issuer
4. Токены после upgrade  → новые access_token + refresh_token
```

### Admin Flow

```
1. Логин кошельком      → POST /api/v1/auth/login/wallet      → wallet admin → токены
2. Админ-панель         → GET  /api/v1/users, /api/v1/admin/patents
3. Review claims        → POST /api/v1/ip-claims/{id}/review
```

> **ВАЖНО (v3.1):**
> - ✅ **Регистрация** требует `email` + `solana_wallet_address` (Solana). Пароль больше не нужен.
> - ✅ **Логин** только через `POST /auth/login/wallet` (email/password удалён).
> - ✅ **Подача патента** — endpoint `POST /auth/submit-patent` с OTP на email/phone.
> - ✅ **Upgrade investor → issuer** происходит автоматически после OTP верификации патента.
> - ❌ **Удалены endpoints:** `/auth/register/wallet`, `/auth/login` (email/password), `/ip-claims` (POST).
> - ❌ **Удалены endpoints кошельков:** `/users/wallets/*` (wallet-only управление удалено).
> - **OTP delivery:** По умолчанию OTP приходит на **email** (SMTP). Для SMS: `ENABLE_SMS_OTP=True`.

---

## Ошибки

| Код | Значение | Когда |
|-----|----------|-------|
| 200 | OK | Всё прошло |
| 201 | Created | Ресурс создан |
| 400 | Bad Request | Неправильные данные |
| 401 | Unauthorized | Нет токена / просрочен |
| 403 | Forbidden | Токен есть, но нет прав |
| 404 | Not Found | Ресурс не найден |
| 422 | Validation Error | Неверный формат данных |
| 500 | Server Error | Что-то сломалось на сервере |

Формат ошибки:
```json
{ "detail": "Описание ошибки" }
```

---

## 1. Auth — `/api/v1/auth`

### 1.1 Регистрация инвестора
**POST** `/api/v1/auth/register`

Создаёт пользователя с ролью `investor`. Требует email + Solana wallet address. Пароль не нужен.

| Поле | Тип | Обязательно | Описание |
|------|-----|:-----------:|----------|
| `email` | string (EmailStr) | ✅ | Email |
| `solana_wallet_address` | string | ✅ | Solana wallet (base58, 32-44 chars) |
| `role` | string | ❌ | Всегда `investor` (другие роли запрещены) |
| `legal_name` | string | ❌ | ФИО / название организации |
| `country` | string | ❌ | Код страны: `US`, `RU`, `EP`... |

Ответ (201):
```json
{
  "message": "Investor registered successfully. Login with wallet to get tokens."
}
```

> ⚠️ После регистрации нужно залогиниться через `/auth/login/wallet` чтобы получить токены.

---

### 1.2 Логин через кошелёк
**POST** `/api/v1/auth/login/wallet`

Единственный способ получить токены. Если wallet не найден → 404 (сначала зарегистрируйтесь).

| Поле | Тип | Обязательно | Описание |
|------|-----|:-----------:|----------|
| `wallet_address` | string | ✅ | Solana wallet address (base58, 32-44 chars) |
| `network` | string | ❌ | Сеть (по умолч.: `solana`) |

Ответ (200):
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "role": "investor",
  "is_new_user": false
}
```

> ⚠️ Если wallet не существует → 404: "Wallet not found. Please register first via POST /api/v1/auth/register"

---

### 1.3 Подача патента (OTP flow)
**POST** `/api/v1/auth/submit-patent`

> ⚠️ **Только роль `investor`.** Требуется авторизация (Bearer token). После OTP верификации роль меняется на `issuer`.

| Поле | Тип | Обязательно | Описание |
|------|-----|:-----------:|----------|
| `patent_number` | string | ✅ | Номер патента (3-100 chars) |
| `patent_title` | string | ✅ | Название патента (2-255 chars) |
| `claimed_owner_name` | string | ✅ | ФИО владельца (2-255 chars) |
| `email` | string (EmailStr) | ✅ | Email для OTP |
| `phone` | string | ✅ | Телефон для OTP (E.164: `+79991234567`, 7-20 chars) |
| `description` | string | ❌ | Описание |
| `jurisdiction` | string | ❌ | `US` (по умолч.), `EP`, `WO` |

Ответ (200):
```json
{
  "message": "OTP sent. Please verify to complete patent submission and upgrade to issuer role.",
  "otp_sent_to": "n***@gmail.com",
  "otp_purpose": "patent_submission",
  "submission_id": "uuid-claim-id"
}
```

> ⚠️ Требуется авторизация. Создаёт IpClaim в статусе `submitted`. OTP отправляется на email и phone.

---

### 1.4 Верификация OTP патента
**POST** `/api/v1/auth/submit-patent/verify-otp`

Подтверждает OTP код. После успешной верификации:
- Роль меняется: `investor` → `issuer`
- IpClaim статус: `submitted` → `prechecked`
- Возвращаются новые токены

| Поле | Тип | Обязательно | Описание |
|------|-----|:-----------:|----------|
| `email` | string (EmailStr) | ✅ | Email, на который отправлен OTP |
| `code` | string | ✅ | 6-значный OTP код |
| `submission_id` | string | ✅ | UUID IpClaim из ответа submit-patent |

Ответ (200):
```json
{
  "verified": true,
  "role_upgraded": true,
  "new_role": "issuer",
  "access_token": "eyJ...",
  "refresh_token": "eyJ..."
}
```

> ⚠️ Максимум 5 попыток. После — блокировка OTP. Ошибки: `OTP_EXPIRED` (404), `OTP_NOT_FOUND` (404), `OTP_BLOCKED` (409), `OTP_INVALID` (422).

---

### 1.5 Отправка OTP (generic)
**POST** `/api/v1/auth/otp-send`

Универсальный endpoint для отправки OTP через Redis.

| Поле | Тип | Обязательно | Описание |
|------|-----|:-----------:|----------|
| `identifier` | string | ✅ | Email или телефон (E.164) |
| `purpose` | string | ✅ | `register`, `login`, `password_reset`, `issuer_upgrade`, `patent_submission`, `patent_submission_phone` |

Ответ (200):
```json
{ "success": true }
```

---

### 1.6 Подтверждение OTP (generic)
**POST** `/api/v1/auth/otp-verify`

Универсальный endpoint для OTP верификации.

| Поле | Тип | Обязательно | Описание |
|------|-----|:-----------:|----------|
| `identifier` | string | ✅ | Email или телефон (E.164) |
| `code` | string | ✅ | 6 цифр |
| `purpose` | string | ✅ | `register`, `login`, `password_reset`, `issuer_upgrade` |

Ответ (200):
```json
{
  "verified": true,
  "verified_token": "eyJ..."
}
```

> **`issuer_upgrade`** — используется для подтверждения смены роли с `investor` на `issuer` через `/users/upgrade-to-issuer`.

---

### 1.7 Обновить токен
**POST** `/api/v1/auth/refresh`

Получить новый `access_token` по `refresh_token`.

| Поле | Тип | Обязательно |
|------|-----|:-----------:|
| `refresh_token` | string | ✅ |

Ответ (200):
```json
{
  "role": "investor",
  "access_token": "eyJ...",
  "refresh_token": "eyJ..."
}
```

---

### 1.8 Выйти
**DELETE** `/api/v1/auth/logout`

Отзывает refresh_token. Тело запроса: `{"refresh_token": "..."}`

Ответ (200):
```json
{ "success": true, "message": "Сессия завершена" }
```

---

### 1.9 Сброс пароля
**PUT** `/api/v1/auth/password-reset`

| Поле | Тип | Обязательно |
|------|-----|:-----------:|
| `email` | string (EmailStr) | ✅ |
| `new_password` | string | ✅ | Мин. 8 символов |

Ответ (200):
```json
{ "message": "Пароль обновлен" }
```

---

### 1.10 Текущий пользователь
**GET** `/api/v1/auth/me`

Ответ (200):
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "role": "investor",
  "status": "active",
  "verification_status": "pending"
}
```

> ⚠️ `email` может быть `null` для wallet-only пользователей. `verification_status` — статус последней VerificationCase.

---

## 2. Пользователь — `/api/v1/users`

### 2.1 Мой профиль
**GET** `/api/v1/users/profile` — получить
**PUT** `/api/v1/users/profile` — обновить

Тело PUT (все поля необязательные):
```json
{
  "legal_name": "Новое имя",
  "country": "US"
}
```

Ответ ProfileRead:
```json
{
  "legal_name": "John Doe",
  "country": "US"
}
```

---

### 2.2 Верификация (требует роль `issuer`)

**Загрузить документы**
**POST** `/api/v1/users/verification/documents`

Формат: `multipart/form-data`

| Поле | Тип | Обязательно |
|------|-----|:-----------:|
| `id_document` | file | ✅ |
| `selfie` | file | ✅ |
| `video` | file | ❌ |
| `user_address` | string | ✅ |

Ответ (201):
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "patent_name": null,
  "patent_address": null,
  "user_address": "Москва, ул. Примерная, 1",
  "id_document_url": "/uploads/...",
  "selfie_url": "/uploads/...",
  "video_url": "/uploads/...",
  "status": "pending",
  "reviewer_notes": null,
  "created_at": "2026-04-05T10:00:00Z"
}
```

**Проверить статус**
**GET** `/api/v1/users/verification/status`

Ответ (200):
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "status": "pending",
  "reviewer_notes": null,
  "created_at": "2026-04-05T10:00:00Z"
}
```

Статусы: `not_started` → `pending` → `approved` / `rejected`

> ⚠️ Если верификация не найдена → 404. Если уже есть `pending` или `approved` → 400 при повторной попытке.

---

### 2.3 Обновить роль до issuer
**POST** `/api/v1/users/upgrade-to-issuer`

Альтернативный способ upgrade через OTP (не через патент).

Запускает OTP flow на email пользователя. После OTP верификации (через `/auth/otp-verify` с `purpose=issuer_upgrade`) роль меняется на `issuer`.

Ответ (200):
```json
{
  "message": "OTP sent to your email. Verify OTP to complete upgrade to issuer."
}
```

> ⚠️ Требует роль `investor`. Email должен быть заполнен в профиле.

---

### 2.4 Удалить аккаунт
**DELETE** `/api/v1/users/account`

Soft-delete: статус меняется на `blocked`.

> ⚠️ Issuers не могут удалить аккаунт, если есть активные IP claims (статусы: `draft`, `submitted`, `prechecked`, `under_review`).

Ответ (200):
```json
{ "success": true, "message": "Account deleted successfully" }
```

---

## 3. IP Claims — `/api/v1/ip-claims`

> ⚠️ Создание claim теперь через `POST /auth/submit-patent` (с OTP flow).

### 3.1 Список claims
**GET** `/api/v1/ip-claims?status=submitted&skip=0&limit=20`

| Параметр | Тип | Описание |
|----------|-----|----------|
| `status` | string | Фильтр по статусу |
| `skip` | int | Пропустить N (пагинация) |
| `limit` | int | Вернуть N (по умолч. 20, макс 100) |

Ответ:
```json
{
  "total": 42,
  "items": [
    {
      "id": "uuid",
      "issuer_user_id": "uuid",
      "patent_number": "1234567",
      "patent_title": "My Patent",
      "claimed_owner_name": "Acme Corp",
      "description": "...",
      "jurisdiction": "US",
      "status": "submitted",
      "prechecked": false,
      "precheck_status": null,
      "source_id": null,
      "checked_at": null,
      "patent_metadata": {},
      "external_metadata": {},
      "created_at": "2026-04-05T10:00:00Z",
      "updated_at": "2026-04-05T10:00:00Z"
    }
  ]
}
```

---

### 3.2 Один claim
**GET** `/api/v1/ip-claims/{claim_id}`

> ⚠️ Доступно только владельцу claim или admin.

---

### 3.3 Загрузить документ
**POST** `/api/v1/ip-claims/{claim_id}/documents`

Формат: `multipart/form-data`

| Поле | Тип | Обязательно |
|------|-----|:-----------:|
| `file` | file | ✅ |
| `doc_type` | string | ❌ | Тип документа |

> ⚠️ Доступно только владельцу claim или admin.

---

### 3.4 Рецензия на claim
**POST** `/api/v1/ip-claims/{claim_id}/review`

Только `admin`.

| Поле | Тип | Обязательно |
|------|-----|:-----------:|
| `decision` | string | ✅ | `approve`, `reject`, `request_more_data` |
| `notes` | string | ❌ | |

---

## 4. IP Intelligence — `/api/v1/patents`

### 4.1 Проверка патента (международная)
**POST** `/api/v1/patents/precheck/international`

| Поле | Тип | Обязательно | Описание |
|------|-----|:-----------:|----------|
| `patent_number` | string | ✅ | Номер патента |
| `country_code` | string | ✅ | `US`, `EP`, `WO` |
| `kind_code` | string | ❌ | Kind code (B2, A1...) |
| `include_analytics` | bool | ❌ | Включить цитирования, классы |

Ответ (200):
```json
{
  "exists": true,
  "primary_source": "USPTO",
  "normalized_record": {
    "source": "USPTO",
    "source_id": "1234567",
    "country_code": "US",
    "kind_code": "B2",
    "title": "Test Patent",
    "abstract": "An invention...",
    "filing_date": "2020-01-01",
    "publication_date": "2021-01-01",
    "grant_date": "2022-01-01",
    "status": "granted",
    "assignees": [{"name": "Acme Corp", "type": "company", "country": "US"}],
    "inventors": [{"name": "John Doe", "country": "US"}],
    "cpc_classes": ["H04L9/00"],
    "citations_count": 10
  },
  "recommendation": "recommended",
  "warnings": [],
  "cached": false
}
```

> **`recommendation`** — подсказка для фронтенда:
> - `"recommended"` — патент активен, можно токенизировать
> - `"requires_review"` — pending, нужен ручной review
> - `"not_recommended"` — expired/revoked, нельзя
> - `"caution"` — неизвестный статус

---

### 4.2 Международный поиск
**POST** `/api/v1/patents/search/international`

| Поле | Тип | Обязательно | Описание |
|------|-----|:-----------:|----------|
| `query` | string | ✅ | Ключевые слова |
| `countries` | string[] | ❌ | Фильтр стран: `["US", "EP"]` |
| `date_from` | string | ❌ | Дата от (ISO: `2020-01-01`) |
| `date_to` | string | ❌ | Дата до |
| `page` | int | ❌ | Страница (по умолч. 1) |
| `per_page` | int | ❌ | Размер (1–100, по умолч. 20) |

---

### 4.3 Обогащение claim
**POST** `/api/v1/patents/ip-claims/{claim_id}/enrich/international`

| Поле | Тип | Обязательно | Описание |
|------|-----|:-----------:|----------|
| `force_refresh` | bool | ❌ | Игнорировать кэш |
| `sources` | string[] | ❌ | `["USPTO", "PATENTSVIEW"]` |

---

### 4.4 Health
**GET** `/api/v1/patents/health`

Без авторизации.

---

## 5. Admin — Пользователи — `/api/v1/users`

Только роль `admin`.

### 5.1 Список
**GET** `/api/v1/users?skip=0&limit=20&role=issuer&status=active&search=ivan`

| Параметр | Тип | Описание |
|----------|-----|----------|
| `skip` | int | Пропустить |
| `limit` | int | Вернуть (1-100, по умолч. 50) |
| `role` | string | Фильтр по роли |
| `status` | string | Фильтр по статусу |
| `search` | string | Поиск по email + имени |

---

### 5.2 Детали
**GET** `/api/v1/users/{user_id}`

Возвращает `UserAdminDetailResponse` с:
- Базовая информация (id, email, role, status, profile)
- `kyc_status` — последний статус KYC
- `wallet_count` — количество кошельков
- `verification_status` — статус верификации

---

### 5.3 Обновить
**PUT** `/api/v1/users/{user_id}`

| Поле | Тип | Описание |
|------|-----|----------|
| `full_name` | string | |
| `country` | string | |
| `organization_name` | string | |
| `preferred_language` | string | |
| `role` | string | Смена роли (логируется) |

---

### 5.4 Сменить статус
**PUT** `/api/v1/users/{user_id}/status`

| Поле | Тип | Обязательно |
|------|-----|:-----------:|
| `status` | string | ✅ | `active`, `suspended`, `blocked`, `rejected` |
| `reason` | string | ✅ | Мин. 5 символов |

---

### 5.5 Удалить (мягкое)
**DELETE** `/api/v1/users/{user_id}`

Soft-delete: статус меняется на `blocked`. Admin'ов удалять нельзя.

---

## 6. Admin — Патенты — `/api/v1/admin/patents`

Роль: `admin`.

### 6.1 Список
**GET** `/api/v1/admin/patents?skip=0&limit=20&status=under_review&jurisdiction=US`

### 6.2 Детали
**GET** `/api/v1/admin/patents/{patent_id}`

### 6.3 Сменить статус
**PUT** `/api/v1/admin/patents/{patent_id}/status`

| Поле | Тип | Обязательно |
|------|-----|:-----------:|
| `status` | string | ✅ | `approved`, `rejected`, `archived` |
| `notes` | string | ✅ | Причина |

---

## 7. Утилиты

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/v1/ping` | `{"message": "pong"}` |
| GET | `/health` | Health check всего приложения |
| GET | `/` | `{"status": "ok", "version": "1.0.0"}` |

---

## Роли — что могут

| Endpoint | issuer | investor | admin |
|----------|:------:|:--------:|:-----:|
| Auth (все) | ✅ | ✅ | ✅ |
| `/auth/register` | ❌ | ✅ | ❌ |
| `/auth/login/wallet` | ✅ | ✅ | ✅ |
| `/auth/submit-patent` | ❌ | ✅ | ❌ |
| `/auth/submit-patent/verify-otp` | ❌ | ✅ | ❌ |
| `/auth/me` | ✅ | ✅ | ✅ |
| `/users/profile` | ✅ | ✅ | ✅ |
| `/users/verification/*` | ✅ (docs POST, status GET) | ❌ | ❌ |
| `/users/upgrade-to-issuer` | ❌ | ✅ | ✅ |
| `/users/account` (DELETE) | ✅ | ✅ | ✅ |
| `/ip-claims` (list, get, docs) | ✅ | ✅ | ✅ |
| `/ip-claims/*/review` | ❌ | ❌ | ✅ |
| `/patents/precheck` | ✅ | ✅ | ✅ |
| `/patents/search` | ✅ | ✅ | ✅ |
| `/patents/*/enrich` | ✅ (свой) | ❌ | ❌ |
| `/users` (admin CRUD) | ❌ | ❌ | ✅ |
| `/admin/patents` | ❌ | ❌ | ✅ |

> **Примечание (v3.1):**
> - Роль `compliance_officer` объединена с `admin`.
> - Роль `user` удалена.
> - Остались только: `investor`, `issuer`, `admin`.
> - Investor → Issuer upgrade происходит через `POST /auth/submit-patent` + OTP verification.
> - **Wallet эндпоинты удалены** (`/users/wallets/*`). Управление кошельками только при регистрации и логине.
> - **Регистрация** требует `email` + `solana_wallet_address`. `user_id` больше не возвращается.
