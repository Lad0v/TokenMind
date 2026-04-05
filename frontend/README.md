# TokenMind Frontend

Современный фронтенд-проект платформы **TokenMind** для управления интеллектуальной собственностью, KYC и маркетплейса патентов.

## 📱 Описание

Полнофункциональное веб-приложение на Next.js с поддержкой нескольких ролей:
- **Публичная витрина**: информация о платформе, возможности
- **Аутентификация**: регистрация и вход (email/пароль, кошельки)
- **KYC**: процесс верификации пользователей
- **Кабинет правообладателя**: управление IP претензиями, загрузка патентов
- **Админ-панель**: проверка KYC, IP претензий, аудит операций
- **Маркетплейс**: торговля токенизированными IP активами

## 🛠 Технологический стек

- **Framework**: Next.js 16.2.0 (App Router)
- **Language**: TypeScript
- **UI Library**: Radix UI
- **Styling**: Tailwind CSS + PostCSS
- **Icons**: Lucide React
- **Forms**: React Hook Form
- **Date Handling**: date-fns
- **Theme**: next-themes (темная тема)
- **Bundler**: Next.js built-in

## 📁 Структура проекта

```
frontend/
├── app/                      # Next.js App Router структура
│   ├── page.tsx             # Главная страница (витрина)
│   ├── layout.tsx           # Корневой layout
│   ├── globals.css          # Глобальные стили
│   ├── auth/                # Аутентификация
│   │   ├── login/           # Страница входа
│   │   └── register/        # Страница регистрации
│   ├── admin/               # Админ-панель
│   │   ├── kyc/             # Управление KYC
│   │   ├── audit/           # Логирование операций
│   │   ├── ip-reviews/      # Проверка IP претензий
│   │   └── assets/          # Статические ресурсы
│   ├── issuer/              # Кабинет правообладателя
│   │   └── ip/              # Управление IP активами
│   └── marketplace/         # Маркетплейс
│       └── [listingId]/     # Детали листинга
├── components/              # React компоненты
│   ├── landing/             # Секции главной страницы
│   │   ├── hero.tsx
│   │   ├── features.tsx
│   │   ├── how-it-works.tsx
│   │   ├── cta.tsx
│   │   ├── footer.tsx
│   │   └── header.tsx
│   ├── ui/                  # UI компоненты (Radix-based)
│   │   ├── accordion.tsx
│   │   ├── alert-dialog.tsx
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   ├── form.tsx
│   │   └── ... (другие примитивные компоненты)
│   └── user/                # Компоненты профиля и аккаунта
├── hooks/                   # React hooks
│   ├── use-mobile.ts       # Мобильный брейкпоинт
│   └── use-toast.ts        # Toast уведомления
├── lib/                     # Утилиты и helpers
│   └── utils.ts            # CSS класс утилиты
├── public/                  # Статические файлы
├── styles/                  # CSS стили
└── package.json            # Зависимости проекта
```

## ⚙️ Доступные команды

```bash
# Установка зависимостей
npm install

# Разработка (с hot reload)
npm run dev

# Production build
npm run build

# Запуск production сервера
npm start

# Проверка кода (ESLint)
npm run lint
```

## 🎨 Дизайн система

### Цветовая палитра
- **Primary**: Темный изумруд (темная тема по умолчанию)
- **Accent**: Неоновые акценты для CTAs
- **Neutral**: Серые тона для фона и текста

### Типография
- **Display**: `Cormorant Garamond`, `Playfair Display` — элегантные заголовки
- **Tech**: `Space Grotesk` — технические элементы и акценты
- **Body**: Системный шрифт — основной текст

### Визуальные эффекты
- Glass-морфизм карточек
- Градиенты и shader эффекты
- Тонкие grid/noise оверлеи
- Smooth transitions и микроинтеракции

## 🔄 Product Flow

Приложение покрывает полный цикл:
1. **Регистрация** → Email/пароль или подключение кошелька
2. **KYC верификация** → Upload документов, прохождение проверки
3. **IP Claim** → Подача заявки на интеллектуальную собственность
4. **Pre-check** → Автоматическая проверка и обогащение данных
5. **Admin Review** → Ручная проверка администратором
6. **Tokenization** → Создание токенов после одобрения
7. **Marketplace** → Листинг и торговля на маркетплейсе инвесторов

## 🔐 Аутентификация

На текущий момент проект использует **mock-сессию** для разработки:
- Файл: `components/` (RoleGuard или похожий)
- `MOCK_SESSION_STORE` позволяет переключаться между ролями в интерфейсе
- **В production** необходимо подключить реальную авторизацию от backend (JWT, OAuth и т.д.)

## 📦 Основные зависимости

| Пакет | Версия | Назначение |
|-------|--------|-----------|
| next | 16.2.0 | React framework |
| @radix-ui/* | latest | Accessible UI components |
| react-hook-form | ^7.x | Form management |
| tailwindcss | - | CSS framework |
| lucide-react | ^0.564.0 | Icon library |
| date-fns | 4.1.0 | Date utilities |
| next-themes | ^0.4.6 | Theme management |

## 🚀 Getting Started

### Предварительные требования
- Node.js 18+
- npm или yarn

### Установка и запуск

```bash
# 1. Перейти в папку frontend
cd frontend

# 2. Установить зависимости
npm install

# 3. Запустить dev сервер
npm run dev

# 4. Открыть в браузере
# http://localhost:3000
```

## ✅ Quality Assurance

```bash
# ESLint проверка
npm run lint

# Production build (проверка на ошибки сборки)
npm run build
```

## 📝 Notes

- **Mock Session**: Для переключения между ролями в разработке используется mock-сессия. Перед production необходимо интегрировать реальную авторизацию.
- **API Integration**: Frontend готов к интеграции с backend API. Endpoints документированы в backend документации.
- **TypeScript**: Весь код типизирован. Обязательно добавляйте типы к новым компонентам.

## 🔗 Связанные ресурсы

- Backend документация: `../backend/README.md`
- Backend API docs: `../backend/docs/API_FOR_FRONTEND.md`
- Architecture overview: `../backend/architecture.md`

## 📄 Лицензия

Смотреть `../LICENSE`
