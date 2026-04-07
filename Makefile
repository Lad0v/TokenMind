.PHONY: help dev prod build build-dev up down restart logs logs-api ps clean migrate status

COMPOSE_DEV=docker compose -f docker-compose.yml -f docker-compose.override.yml
COMPOSE_PROD=docker compose -f docker-compose.yml

help:
	@echo "TokenMind Docker commands"
	@echo ""
	@echo "  make dev       Start full stack with hot reload"
	@echo "  make prod      Start full stack without dev override"
	@echo "  make build     Build production images"
	@echo "  make build-dev Build development images"
	@echo "  make down      Stop the stack"
	@echo "  make logs-api  Follow API logs"

dev:
	$(COMPOSE_DEV) up -d --build

prod:
	$(COMPOSE_PROD) up -d --build

build:
	$(COMPOSE_PROD) build

build-dev:
	$(COMPOSE_DEV) build

up:
	$(COMPOSE_PROD) up -d

down:
	$(COMPOSE_DEV) down

restart:
	$(COMPOSE_DEV) restart

logs:
	$(COMPOSE_DEV) logs -f

logs-api:
	$(COMPOSE_DEV) logs -f api

ps:
	$(COMPOSE_DEV) ps

clean:
	$(COMPOSE_DEV) down -v --rmi local

migrate:
	$(COMPOSE_PROD) run --rm migrate

status:
	@curl -sf http://localhost:8000/health > /dev/null && echo "API: OK" || echo "API: DOWN"
	@curl -sf http://localhost:9000/minio/health/live > /dev/null && echo "MinIO: OK" || echo "MinIO: DOWN"
