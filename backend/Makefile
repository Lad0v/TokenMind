.PHONY: run dev test makemigrations migrate downgrade docker-up docker-down

ROOT_COMPOSE_DEV=docker compose -f ../docker-compose.yml -f ../docker-compose.override.yml
ROOT_COMPOSE_PROD=docker compose -f ../docker-compose.yml

run:
	uvicorn app.main:app --host 0.0.0.0 --port 8000

dev:
	uvicorn app.main:app --reload

test:
	pytest tests/ -v

makemigrations:
	alembic revision --autogenerate -m "$(msg)"

migrate:
	alembic upgrade head

downgrade:
	alembic downgrade -1

docker-up:
	$(ROOT_COMPOSE_DEV) up --build

docker-down:
	$(ROOT_COMPOSE_DEV) down
