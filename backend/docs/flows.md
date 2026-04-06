# 🔁 ПОЛНЫЙ БИЗНЕС-ФЛОУ ПРОЕКТА (v3.1 — Wallet-First, Solana Required)

---

## 1️⃣ РЕГИСТРАЦИЯ ИНВЕСТОРА (email + Solana wallet)

```
User → POST /api/v1/auth/register
  body: { email, solana_wallet_address, legal_name?, country? }
  ↓
Backend:
  1. Валидирует solana_wallet_address (base58, 32-44 chars)
  2. Проверяет что email и wallet свободны
  3. Создаёт User (status=active, role=investor, password_hash=null)
  4. Создаёт Profile (legal_name, country — если переданы)
  5. Создаёт WalletLink (is_primary=True, network="solana")
  6. AuditLog: "auth.register_investor"
  ↓
Response 201: { message: "Investor registered successfully. Login with wallet to get tokens." }
```

**Далее инвестор логинится через кошелёк:**

```
User → POST /api/v1/auth/login/wallet
  body: { wallet_address, network: "solana" }
  ↓
Backend:
  1. Ищет WalletLink по wallet_address + network
  2. Если не найден → 404 (нужно сначала зарегистрироваться)
  3. Находит пользователя, проверяет статус
  4. Если suspended/blocked → 403
  5. Генерирует access_token + refresh_token (sub = user.id UUID)
  6. AuditLog: "auth.wallet_login"
  ↓
Response 200: { access_token, refresh_token, role: "investor", is_new_user: false }
```

> ⚠️ `user_id` больше не возвращается. `sub` в JWT — это UUID пользователя.

---

## 2️⃣ ПОДАЧА ПАТЕНТА (investor → issuer через OTP)

### Шаг 1: Отправка заявки

```
Investor → POST /api/v1/auth/submit-patent
  Headers: Authorization: Bearer <access_token>
  body: {
    patent_number, patent_title, claimed_owner_name,
    email, phone, description?, jurisdiction?
  }
  ↓
Backend:
  1. Проверяет роль (должна быть investor)
  2. Проверяет наличие primary wallet
  3. Создаёт IpClaim (status="submitted", prechecked=false)
  4. Генерирует OTP → Redis (purpose: "patent_submission")
  5. Отправляет OTP на email (SMTP)
  6. Если ENABLE_SMS_OTP=True → отправляет OTP на phone (SMS)
  7. AuditLog: "patent.submission_otp_sent"
  ↓
Response 200: {
    message: "OTP sent. Please verify...",
    otp_sent_to: "j***@example.com",
    otp_purpose: "patent_submission",
    submission_id: "<claim_uuid>"
}
```

### Шаг 2: Верификация OTP

```
Investor → POST /api/v1/auth/submit-patent/verify-otp
  Headers: Authorization: Bearer <access_token>
  body: { email, code: "123456", submission_id: "<claim_uuid>" }
  ↓
Backend:
  1. Верифицирует OTP из Redis (HMAC-SHA256 hashed)
  2. Находит IpClaim по submission_id
  3. Меняет User.role: investor → issuer
  4. Меняет IpClaim.status: submitted → prechecked
  5. Генерирует новые access_token + refresh_token
  6. AuditLog: "user_role_upgraded_to_issuer"
  ↓
Response 200: {
    verified: true,
    role_upgraded: true,
    new_role: "issuer",
    access_token: "eyJ...",
    refresh_token: "eyJ..."
}
```

> ⚠️ **Без OTP верификации** роль остаётся `investor`, claim остаётся `submitted`.

---

## 3️⃣ АЛЬТЕРНАТИВНЫЙ UPGRADE: investor → issuer (без патента)

```
Investor → POST /api/v1/users/upgrade-to-issuer
  Headers: Authorization: Bearer <access_token>
  ↓
Backend:
  1. Проверяет роль (только investor)
  2. Проверяет наличие email
  3. Генерирует OTP → Redis (purpose: "issuer_upgrade")
  4. Отправляет OTP на email
  5. AuditLog: "user_upgrade_to_issuer"
  ↓
Response 200: { message: "OTP sent to your email..." }

Затем:
Investor → POST /api/v1/auth/otp-verify
  body: { identifier: email, code: "123456", purpose: "issuer_upgrade" }
  ↓
Response 200: { verified: true, verified_token: "eyJ...", role_changed: true, new_role: "issuer" }
```

---

## 4️⃣ УДАЛЁННЫЕ ENDPOINTS (v3.1)

| Endpoint | Статус | Замена |
|----------|--------|--------|
| `POST /auth/register/wallet` | ❌ УДАЛЁН | `POST /auth/register` (требует email + solana_wallet_address) |
| `POST /auth/login` (email+password) | ❌ УДАЛЁН | `POST /auth/login/wallet` |
| `POST /ip-claims` | ❌ УДАЛЁН | `POST /auth/submit-patent` (с OTP flow) |
| `/users/wallets/*` | ❌ УДАЛЁН | Wallet управляется при регистрации |
| `/users/verification/review/{id}` | ❌ УДАЛЁН | Admin review через отдельный pipeline |

---

## 5️⃣ ВЕРИФИКАЦИЯ ЭМИТЕНТА (KYC документы)

### Загрузка документов

```
Issuer → POST /api/v1/users/verification/documents
  Headers: Authorization: Bearer <access_token>
  Form-Data:
    - id_document: File (passport.png)     ✅ обязательно
    - selfie: File (selfie.png)            ✅ обязательно
    - video: File (optional)               ❌ необязательно
    - user_address: "123 Main St, NY"      ✅ обязательно
  ↓
Backend:
  1. Проверяет роль (только issuer)
  2. Проверяет, нет ли активной верификации (pending/approved → 400)
  3. Если rejected → обновляет существующий VerificationCase
  4. Сохраняет файлы (MinIO → fallback на локальную FS)
  5. Создаёт VerificationCase (status=pending)
  ↓
Response 201: { id, status: "pending", user_address: "...", ... }
```

### Проверка статуса

```
Issuer → GET /api/v1/users/verification/status
  ↓
Response 200: { id, status: "pending", created_at: "..." }
Response 404: если нет случаев верификации
```

Статусы: `not_started` → `pending` → `approved` / `rejected`

> ⚠️ После `rejected` можно перезалить документы. После `approved` — нельзя.

---

## 6️⃣ УПРАВЛЕНИЕ IP CLAIM (документы + review)

### Список claims

```
User → GET /api/v1/ip-claims?status=submitted&skip=0&limit=20
  ↓
Response: { total: N, items: [ { id, patent_number, patent_title, ... }, ... ] }
```

### Получить один claim

```
User → GET /api/v1/ip-claims/{claim_id}
  ↓
Backend:
  1. Владелец claim → 200
  2. Admin → 200
  3. Остальные → 403
```

### Загрузка документа

```
Issuer → POST /api/v1/ip-claims/{claim_id}/documents
  Headers: Authorization: Bearer <access_token>
  Form-Data:
    - file: UploadFile (patent_certificate.pdf)  ✅
    - doc_type: string                           ❌
  ↓
Backend:
  1. Проверяет права (владелец claim или admin)
  2. Сохраняет файл через file_storage
  3. Создаёт IpDocument record
  ↓
Response 200: { id, file_url, doc_type, ... }
```

### Admin Review IP Claim

```
Admin → POST /api/v1/ip-claims/{claim_id}/review
  Headers: Authorization: Bearer <access_token>
  body: { decision: "approve" | "reject" | "request_more_data", notes: "..." }
  ↓
Backend (IpClaimService):
  1. Создаёт IpReview record
  2. decision=approve   → IpClaim.status: "approved"
  3. decision=reject    → IpClaim.status: "rejected"
  4. request_more_data  → IpClaim.status: "submitted" (возврат)
  5. AuditLog: "ip_claim.reviewed"
  ↓
Response 200: { id, status: "approved", ... }
```

---

## 7️⃣ ПРОВЕРКА ПАТЕНТА + ОБОГАЩЕНИЕ

### Precheck (международная проверка)

```
User → POST /api/v1/patents/precheck/international
  body: { patent_number, country_code: "US", kind_code?, include_analytics? }
  ↓
Backend (PatentStatusCheckService):
  1. Проверяет PatentCache в БД (TTL 48ч)
  2. Если нет → запрос к внешнему API (USPTO/EPO/WIPO)
  3. Нормализация ответа
  4. Кэширование
  5. Рекомендация: granted→"recommended", pending→"requires_review", expired→"not_recommended"
  ↓
Response: { exists, primary_source, normalized_record, recommendation, cached }
```

### Обогащение claim

```
Issuer → POST /api/v1/patents/ip-claims/{claim_id}/enrich/international
  body: { force_refresh?, sources? }
  ↓
Backend (PatentDataEnrichmentService):
  1. Загружает IpClaim
  2. Запрос к внешним API (USPTO, PatentsView...)
  3. Обновляет claim: patent_title, prechecked, precheck_status, external_metadata
  ↓
Response: { enriched: true, sources_used, updated_fields, warnings }
```

---

## 8️⃣ АДМИНИСТРИРОВАНИЕ ПОЛЬЗОВАТЕЛЕЙ

```
Admin → GET /api/v1/users?skip=0&limit=50&role=issuer&status=active&search=john
  ↓
Response: { total: N, items: [ { id, email, role, status, profile? }, ... ] }

Admin → PUT /api/v1/users/{user_id}
  body: { full_name?, country?, organization_name?, preferred_language?, role? }

Admin → PUT /api/v1/users/{user_id}/status
  body: { status: "suspended" | "blocked" | "active" | "rejected", reason: "..." }

Admin → DELETE /api/v1/users/{user_id}
  → Soft delete (status=blocked)
```

---

## 9️⃣ УДАЛЕНИЕ АККАУНТА

```
User → DELETE /api/v1/users/account
  ↓
Backend:
  1. Investor → может удалить всегда
  2. Issuer → проверяет активные IP claim'ы (draft/submitted/prechecked/under_review)
     - Если есть → 400
  3. Soft delete: User.status = "blocked"
  4. AuditLog: "user_account_deleted"
  ↓
Response: { success: true, message: "Account deleted successfully" }
```

---

## 🔟 TOKEN MANAGEMENT

### Refresh

```
User → POST /api/v1/auth/refresh
  body: { refresh_token: "eyJ..." }
  ↓
Backend:
  1. Декодирует refresh_token (sub = user.id UUID или email)
  2. Проверяет что не отозван
  3. Возвращает новые токены
  ↓
Response: { role, access_token, refresh_token }
```

### Logout (Token Revocation)

```
User → DELETE /api/v1/auth/logout
  body: { refresh_token: "eyJ..." }
  ↓
Backend:
  1. Извлекает jti и exp из токена
  2. Записывает в TokenRevocation (jti, token_type, expires_at)
  3. При следующем использовании → 401
  ↓
Response: { success: true, message: "Сессия завершена" }
```

---

## 1️⃣1️⃣ ПОЛНЫЙ СКВОЗНОЙ ФЛОУ: От регистрации до токенизации (v3.1)

```
1. Регистрация инвестора:
   POST /auth/register { email, solana_wallet_address }
   → User created, status=active, role=investor

2. Логин через кошелёк:
   POST /auth/login/wallet { wallet_address, network: "solana" }
   → access_token + refresh_token

3. Upgrade до issuer (альтернативный):
   POST /users/upgrade-to-issuer
   → OTP sent на email

   POST /auth/otp-verify { email, code, purpose: "issuer_upgrade" }
   → Role changed: investor → issuer

4. ИЛИ Подача патента (с OTP):
   POST /auth/submit-patent { patent_number, email, phone, ... }
   → OTP sent, submission_id

   POST /auth/submit-patent/verify-otp { email, code, submission_id }
   → Role changed: investor → issuer
   → IpClaim status: submitted → prechecked
   → New tokens

5. Загрузка KYC документов:
   POST /users/verification/documents { id_document, selfie, user_address }

6. Обогащение claim данными:
   POST /patents/ip-claims/{id}/enrich/international
   → external_metadata заполнен из USPTO

7. Админ review claim:
   POST /ip-claims/{id}/review { decision: "approve" }
   → IpClaim.status: "approved"

8. Админ review верификации:
   → Отдельный pipeline (не через REST endpoint)
   → VerificationCase.status: "approved"
   → User.status: "active"

9. Готово! Патент верифицирован, эмитент подтверждён.
```

---

## 🔄 СИСТЕМНЫЕ ПРОЦЕССЫ

### Alembic миграции
```bash
docker compose up alembic
→ alembic upgrade head
→ Создаёт все таблицы в PostgreSQL
```

### Init Admin
```bash
docker compose up init-admin
→ python scripts/init_admin.py
→ Создаёт пользователя admin@localhost / Admin@123
```

### OTP Delivery
- **Email (SMTP)** — по умолчанию, всегда отправляется
- **SMS** — только если `ENABLE_SMS_OTP=True`
- **Fallback** — если SMS выключен, код логируется (для разработки)

---

Это полный флоу от регистрации до получения верифицированного IP claim с данными из международных патентных реестров.
