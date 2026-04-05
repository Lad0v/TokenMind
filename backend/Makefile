.PHONY: run dev test migrate makemigrations

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
	docker-compose up --build

docker-down:
	docker-compose down
