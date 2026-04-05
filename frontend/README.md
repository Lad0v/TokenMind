# VeriMint Frontend (Next.js App Router)

Frontend-прототип платформы IPChain/VeriMint с красивой публичной витриной и role-based интерфейсами:

- Публичная витрина `/`
- Аутентификация `/auth/sign-in`, `/auth/sign-up`
- KYC `/kyc`
- Кабинет правообладателя `/issuer`, `/issuer/claims/new`, `/issuer/claims/[id]`
- Инвесторский маркетплейс `/investor/marketplace`
- Портфель инвестора `/investor/portfolio`
- Админ-панель `/admin`, `/admin/kyc`, `/admin/claims`

## Visual style

- Dark emerald palette
- Display typography: `Cormorant Garamond`, `Playfair Display`
- Tech accent typography: `Space Grotesk`
- Glass cards, gradients, subtle grid/noise overlays

## Product flow covered in UI

1. Регистрация (email/password или wallet)
2. KYC
3. Подача patent claim
4. Pre-check + enrichment
5. Admin review
6. Tokenization after approval
7. Marketplace listing after mint

## Run locally

```bash
npm install
npm run dev
```

## Quality checks

```bash
npm run lint
npm run build
```

> Сейчас проект использует мок-сессию в `src/components/layout/RoleGuard.tsx` (`MOCK_SESSION_STORE`) для переключения ролей в интерфейсе до подключения реальной авторизации.
