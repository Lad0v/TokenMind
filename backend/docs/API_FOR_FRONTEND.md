# API Reference — для Frontend-разработчиков

> Версия: v2.3 (05.04.2026)
> Base URL: `http://localhost:8000/api/v1`
> Формат: JSON
> Авторизация: Bearer-токен в заголовке `Authorization`

---

## Быстрый старт

```
1. Зарегистрироваться   → POST /api/v1/auth/register
2. Получить OTP          → POST /api/v1/auth/otp-send
3. Подтвердить OTP       → POST /api/v1/auth/otp-verify  → получишь verified_token
4. Войти                 → POST /api/v1/auth/login       → получишь access_token + refresh_token
5. Делать запросы        → Добавляй заголовок: Authorization: Bearer <access_token>
6. Обновить токен        → POST /api/v1/auth/refresh
7. Выйти                 → DELETE /api/v1/auth/logout
```

---

## Ошибки

| Код | Значение | Когда |
|-----|----------|-------|
| 200 | OK | Всё прошло |
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

### 1.1 Регистрация
**POST** `/api/v1/auth/register`

Создаёт пользователя. Для обычных ролей (user, issuer) — дальше нужно подтвердить OTP. Для investor — сразу активен.

| Поле | Тип | Обязательно | Описание |
|------|-----|:-----------:|----------|
| `email` | string | ✅ | Email |
| `password` | string | ✅ | Мин. 8 символов |
| `role` | string | ✅ | `user`, `issuer`, `investor` |
| `legal_name` | string | ❌ | ФИО / название организации |
| `country` | string | ❌ | Код страны: `US`, `RU`, `EP`... |

Ответ (200):
```json
{
  "message": "User registered",
  "user_id": "uuid-string"
}
```

---

### 1.2 Отправка OTP
**POST** `/api/v1/auth/otp-send`

Отправляет 6-значный код на email.

| Поле | Тип | Обязательно | Описание |
|------|-----|:-----------:|----------|
| `identifier` | string | ✅ | Email или телефон |
| `purpose` | string | ✅ | `registration`, `password_reset`... |

Ответ (200):
```json
{ "success": true }
```

---

### 1.3 Подтверждение OTP
**POST** `/api/v1/auth/otp-verify`

Проверяет код. Возвращает `verified_token` (JWT на 10 минут) — нужен для следующих шагов.

| Поле | Тип | Обязательно | Описание |
|------|-----|:-----------:|----------|
| `identifier` | string | ✅ | Тот же email/телефон |
| `code` | string | ✅ | 6 цифр |
| `purpose` | string | ✅ | Тот же purpose |

Ответ (200):
```json
{
  "verified": true,
  "verified_token": "eyJ..."
}
```

> ⚠️ Максимум 5 попыток. После — блокировка.

---

### 1.4 Логин
**POST** `/api/v1/auth/login`

Вход по email + пароль.

| Поле | Тип | Обязательно |
|------|-----|:-----------:|
| `email` | string | ✅ |
| `password` | string | ✅ |

Ответ (200):
```json
{
  "role": "user",
  "access_token": "eyJ...",     // жить 30 мин
  "refresh_token": "eyJ..."     // жить 7 дней
}
```

---

### 1.5 Обновить токен
**POST** `/api/v1/auth/refresh`

Получить новый `access_token` по `refresh_token`.

| Поле | Тип | Обязательно |
|------|-----|:-----------:|
| `refresh_token` | string | ✅ |

Ответ (200) — такой же, как у логина.

---

### 1.6 Выйти
**DELETE** `/api/v1/auth/logout`

Отзывает refresh_token.

| Поле | Тип | Обязательно |
|------|-----|:-----------:|
| `refresh_token` | string | ✅ |

Ответ (200):
```json
{ "success": true, "message": "Logged out" }
```

---

### 1.7 Текущий пользователь
**GET** `/api/v1/auth/me`

Требует авторизации (Bearer-токен).

Ответ (200):
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "Иван Иванов",
  "role": "issuer",
  "status": "active",
  "verification_status": "pending"
}
```

---

## 2. Пользователь — `/api/v1/users`

### 2.1 Мой профиль
**GET** `/api/v1/users/profile`  — получить
**PUT** `/api/v1/users/profile`  — обновить

Тело PUT (все поля необязательные):
```json
{
  "legal_name": "Новое имя",
  "country": "US"
}
```

Ответ — обновлённый профиль.

---

### 2.2 Верификация

**Загрузить документы**
**POST** `/api/v1/users/verification/documents`

Формат: `multipart/form-data`

| Поле | Тип | Обязательно |
|------|-----|:-----------:|
| `id_document` | file | ✅ |
| `selfie` | file | ✅ |
| `user_address` | string | ✅ |

**Проверить статус**
**GET** `/api/v1/users/verification/status`

Ответ:
```json
{
  "id": "uuid",
  "status": "pending",
  "patent_name": "...",
  "patent_address": "...",
  "user_address": "...",
  "id_document_url": "/uploads/...",
  "selfie_url": "/uploads/...",
  "reviewer_notes": null,
  "created_at": "2026-04-05T10:00:00Z",
  "updated_at": "2026-04-05T10:00:00Z"
}
```

**Рецензия (admin/compliance_officer)**
**POST** `/api/v1/users/verification/review/{case_id}`

Формат: `multipart/form-data`
| Поле | Тип | Обязательно |
|------|-----|:-----------:|
| `decision` | string | ✅ | `approve`, `reject`, `request_more_data` |
| `notes` | string | ❌ | Комментарий ревьюера |

---

## 3. IP Claims — `/api/v1/ip-claims`

### 3.1 Создать claim
**POST** `/api/v1/ip-claims`

| Поле | Тип | Обязательно | Описание |
|------|-----|:-----------:|----------|
| `patent_number` | string | ✅ | Номер патента |
| `claimed_owner_name` | string | ✅ | Кто заявляет право |
| `patent_title` | string | ❌ | Название |
| `description` | string | ❌ | Описание |
| `jurisdiction` | string | ❌ | `US`, `EP`, `WO` |

Ответ — созданный claim с `id`, `status`, `created_at`.

---

### 3.2 Список claims
**GET** `/api/v1/ip-claims?status=submitted&skip=0&limit=20`

| Параметр | Тип | Описание |
|----------|-----|----------|
| `status` | string | Фильтр по статусу |
| `skip` | int | Пропустить N (пагинация) |
| `limit` | int | Вернуть N (по умолч. 20) |

Ответ:
```json
{
  "total": 42,
  "items": [
    {
      "id": "uuid",
      "patent_number": "1234567",
      "patent_title": "My Patent",
      "claimed_owner_name": "Acme Corp",
      "status": "submitted",
      "prechecked": true,
      "precheck_status": "granted",
      "source_id": "1234567",
      "created_at": "2026-04-05T10:00:00Z"
    }
  ]
}
```

---

### 3.3 Один claim
**GET** `/api/v1/ip-claims/{claim_id}`

Ответ — полный объект claim.

---

### 3.4 Загрузить документ
**POST** `/api/v1/ip-claims/{claim_id}/documents`

Формат: `multipart/form-data`

| Поле | Тип | Обязательно |
|------|-----|:-----------:|
| `file` | file | ✅ |
| `doc_type` | string | ❌ | Тип документа |

---

### 3.5 Рецензия на claim
**POST** `/api/v1/ip-claims/{claim_id}/review`

Только `admin` / `compliance_officer`.

| Поле | Тип | Обязательно |
|------|-----|:-----------:|
| `decision` | string | ✅ | `approve`, `reject`, `request_more_data` |
| `notes` | string | ❌ | |

---

## 4. IP Intelligence — `/api/v1/patents`

### 4.1 Проверка патента (международная)
**POST** `/api/v1/patents/precheck/international`

Проверяет, существует ли патент в международных реестрах (USPTO, EPO, WIPO). Возвращает нормализованные данные + рекомендацию по токенизации.

| Поле | Тип | Обязательно | Описание |
|------|-----|:-----------:|----------|
| `patent_number` | string | ✅ | Номер патента |
| `country_code` | string | ✅ | `US`, `EP`, `WO` |
| `kind_code` | string | ❌ | Kind code (B2, A1...) |
| `search_mode` | string | ❌ | `exact` (по умолч.) или `fuzzy` |
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

Поиск по ключевым словам в нескольких реестрах.

| Поле | Тип | Обязательно | Описание |
|------|-----|:-----------:|----------|
| `query` | string | ✅ | Ключевые слова |
| `countries` | string[] | ❌ | Фильтр стран: `["US", "EP"]` |
| `date_from` | string | ❌ | Дата от (ISO: `2020-01-01`) |
| `date_to` | string | ❌ | Дата до |
| `page` | int | ❌ | Страница (по умолч. 1) |
| `per_page` | int | ❌ | Размер (1–100, по умолч. 20) |

Ответ:
```json
{
  "total": 150,
  "page": 1,
  "per_page": 20,
  "total_pages": 8,
  "results": [
    {
      "source": "USPTO",
      "source_id": "1234567",
      "country_code": "US",
      "title": "AI-based System",
      "publication_date": "2022-06-15",
      "status": "granted",
      "assignees": ["Acme Corp"]
    }
  ],
  "sources_queried": ["USPTO"],
  "deduplicated_count": 3
}
```

---

### 4.3 Обогащение claim
**POST** `/api/v1/patents/ip-claims/{claim_id}/enrich/international`

Обновляет claim данными из внешних API. Только владелец claim.

| Поле | Тип | Обязательно | Описание |
|------|-----|:-----------:|----------|
| `force_refresh` | bool | ❌ | Игнорировать кэш |
| `sources` | string[] | ❌ | `["USPTO", "PATENTSVIEW"]` |

Ответ:
```json
{
  "claim_id": "uuid",
  "enriched": true,
  "sources_used": ["USPTO"],
  "normalized_record": { ... },
  "updated_fields": ["patent_title", "abstract"],
  "warnings": []
}
```

---

### 4.4 Health
**GET** `/api/v1/patents/health`

Без авторизации.

```json
{
  "status": "healthy",
  "module": "ip_intel",
  "sources": {
    "USPTO": { "available": true, "cache_ttl_hours": 72 },
    "PATENTSVIEW": { "available": true, "cache_ttl_hours": 48 }
  }
}
```

---

## 5. Admin — Пользователи — `/api/v1/users`

Только роль `admin`.

### 5.1 Список
**GET** `/api/v1/users?skip=0&limit=20&role=issuer&status=active&search=ivan`

| Параметр | Тип | Описание |
|----------|-----|----------|
| `skip` | int | Пропустить |
| `limit` | int | Вернуть |
| `role` | string | Фильтр по роли |
| `status` | string | Фильтр по статусу |
| `search` | string | Поиск по email + имени |

---

### 5.2 Детали
**GET** `/api/v1/users/{user_id}`

Возвращает: профиль, KYC статус, кошельки, верификация.

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

Разрешённые переходы:
- `active` ↔ `suspended`
- `active` → `blocked`
- `suspended` → `blocked`

---

### 5.5 Удалить (мягкое)
**DELETE** `/api/v1/users/{user_id}`

Устанавливает статус `blocked`. Физически не удаляет.

---

## 6. Admin — Патенты — `/api/v1/admin/patents`

Роли: `admin`, `compliance_officer`.

### 6.1 Список
**GET** `/api/v1/admin/patents?skip=0&limit=20&status=under_review&jurisdiction=US`

---

### 6.2 Детали
**GET** `/api/v1/admin/patents/{patent_id}`

Возвращает: патент, профиль владельца, кол-во документов, рецензии.

---

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
| GET | `/` | `{"project": "...", "version": "v2.3"}` |

---

## Роли — что могут

| Endpoint | user | issuer | investor | compliance_officer | admin |
|----------|:----:|:------:|:--------:|:------------------:|:-----:|
| Auth (все) | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/users/profile` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/users/verification/*` | ✅ | ✅ | ❌ | ✅ (review) | ✅ (review) |
| `/ip-claims` (свой) | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/ip-claims/*/review` | ❌ | ❌ | ❌ | ✅ | ✅ |
| `/patents/precheck` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/patents/search` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/patents/*/enrich` | ✅ (свой) | ✅ (свой) | ❌ | ❌ | ❌ |
| `/users` (admin CRUD) | ❌ | ❌ | ❌ | ❌ | ✅ |
| `/admin/patents` | ❌ | ❌ | ❌ | ✅ | ✅ |
