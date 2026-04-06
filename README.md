# TokenMind - IP Tokenization Platform

Полнофункциональная платформа для токенизации IP-активов на базе Next.js (frontend) и FastAPI (backend).

## 🚀 Быстрый старт

### 1. Клонирование репозитория

```bash
git clone <repository-url>
cd TokenMind
```

### 2. Настройка окружения

```bash
cp .env.example .env
# Отредактируйте .env при необходимости
```

### 3. Запуск в development режиме

```bash
make dev
# или
docker-compose up -d
```

### 4. Запуск в production режиме

```bash
make prod
```

## 📋 Доступные команды

| Команда | Описание |
|---------|----------|
| `make dev` | Запуск в режиме разработки (hot-reload) |
| `make prod` | Запуск в production режиме |
| `make build` | Сборка всех сервисов |
| `make up` | Запуск всех сервисов |
| `make down` | Остановка всех сервисов |
| `make logs` | Просмотр логов |
| `make ps` | Статус сервисов |
| `make clean` | Удаление контейнеров и томов |
| `make migrate` | Запуск миграций БД |
| `make status` | Проверка здоровья сервисов |

## 🏗️ Архитектура

### Сервисы

- **Frontend** (Next.js) - `http://localhost:3000`
- **Backend API** (FastAPI) - `http://localhost:8000`
- **PostgreSQL** - `localhost:5432`
- **Redis** - `localhost:6379`
- **MinIO** (S3 Storage) - `http://localhost:9000`
- **MinIO Console** - `http://localhost:9001`

## 🔧 Технологии

### Frontend
- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Radix UI

### Backend
- FastAPI
- PostgreSQL 16
- Redis 7
- MinIO (S3-compatible storage)
- Alembic (migrations)

## 📝 Структура проекта

```
TokenMind/
├── frontend/              # Next.js приложение
│   ├── app/              # App Router
│   ├── components/       # React компоненты
│   ├── Dockerfile        # Docker конфигурация
│   └── package.json
├── backend/              # FastAPI приложение
│   ├── app/             # Основной код
│   ├── Dockerfile       # Docker конфигурация
│   └── requirements.txt
├── docker-compose.yml    # Основная конфигурация
├── docker-compose.override.yml  # Development overrides
├── .env.example          # Пример переменных окружения
└── Makefile             # Команды управления
```

## 🔐 Безопасность

Не забудьте изменить стандартные пароли в `.env` файле перед деплоем в production!

## 📚 Документация

- [Backend Architecture](backend/architecture.md)
- [IP Intel Module](backend/IP_INTEL_MODULE.md)

## 🛠️ Разработка

### Локальная разработка (без Docker)

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## 🐳 Docker команды

### Production запуск
```bash
docker-compose up -d
```

### Development запуск (с hot-reload)
```bash
TARGET=development docker-compose up -d
```

### Просмотр логов
```bash
docker-compose logs -f frontend
docker-compose logs -f api
```

### Запуск миграций
```bash
docker-compose run --rm alembic alembic upgrade head
```

## 🤝 Contributing

1. Fork репозиторий
2. Создайте ветку (`git checkout -b feature/amazing-feature`)
3. Commit изменения (`git commit -m 'Add amazing feature'`)
4. Push в ветку (`git push origin feature/amazing-feature`)
5. Откройте Pull Request

## 📄 License

Этот проект лицензирован под лицензией MIT - см. файл [LICENSE](LICENSE) для деталей.
