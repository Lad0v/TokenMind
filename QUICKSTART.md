# 🚀 TokenMind - Быстрый старт

## Предварительные требования

- Docker Desktop установлен и запущен
- Docker Compose v2 доступен

## Запуск проекта

### 1️⃣ Development режим (с hot-reload)

```bash
# Из корня проекта D:\TokenMind
make dev

# Или, если make недоступен:
set TARGET=development
docker-compose up -d
```

### 2️⃣ Production режим

```bash
# Из корня проекта D:\TokenMind
make prod

# Или:
docker-compose up -d
```

### 3️⃣ Проверка статуса

```bash
make status

# Вручную:
curl http://localhost:3000  # Frontend
curl http://localhost:8000/health  # Backend API
```

## 📍 Доступные сервисы

| Сервис | URL | Описание |
|--------|-----|----------|
| Frontend | http://localhost:3000 | Next.js приложение |
| Backend API | http://localhost:8000 | FastAPI + Swagger UI |
| PostgreSQL | localhost:5432 | База данных |
| Redis | localhost:6379 | Кэш |
| MinIO API | http://localhost:9000 | S3-совместимое хранилище |
| MinIO Console | http://localhost:9001 | Веб-интерфейс MinIO |

## 🛠️ Полезные команды

```bash
# Просмотр логов
docker-compose logs -f frontend
docker-compose logs -f api

# Перезапуск сервисов
docker-compose restart frontend
docker-compose restart api

# Остановка
docker-compose down

# Полная очистка
docker-compose down -v
```

## ⚠️ Windows PowerShell

Для PowerShell используйте `$env:` вместо `set`:

```powershell
$env:TARGET="development"
docker-compose up -d
```

## 🔧 Troubleshooting

**Frontend не собирается?**
```bash
cd frontend
npm install
npm run build
# Затем через Docker:
docker-compose build frontend
```

**База данных не подключается?**
```bash
# Проверьте логи
docker-compose logs db

# Перезапустите БД
docker-compose restart db

# Запустите миграции
docker-compose run --rm alembic alembic upgrade head
```
