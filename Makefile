.PHONY: help dev prod build up down restart logs clean

# ======================================================================
# TokenMind Makefile
# ======================================================================

help: ## Show this help
	@echo "TokenMind - IP Tokenization Platform"
	@echo ""
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

dev: ## Start development environment
	TARGET=development docker-compose up -d

prod: ## Start production environment
	TARGET=production docker-compose up -d

build: ## Build all services
	docker-compose build

build-dev: ## Build for development
	TARGET=development docker-compose build

up: ## Start all services
	docker-compose up -d

down: ## Stop all services
	docker-compose down

restart: ## Restart all services
	docker-compose restart

logs: ## View logs
	docker-compose logs -f

logs-api: ## View API logs
	docker-compose logs -f api

logs-frontend: ## View Frontend logs
	docker-compose logs -f frontend

ps: ## Show service status
	docker-compose ps

clean: ## Remove all containers and volumes
	docker-compose down -v --rmi local

migrate: ## Run database migrations
	docker-compose run --rm alembic alembic upgrade head

status: ## Check service health
	@echo "Checking service health..."
	@curl -s http://localhost:3000 > /dev/null && echo "✅ Frontend: OK" || echo "❌ Frontend: DOWN"
	@curl -s http://localhost:8000/health > /dev/null && echo "✅ API: OK" || echo "❌ API: DOWN"
	@curl -s http://localhost:9000/minio/health/live > /dev/null && echo "✅ MinIO: OK" || echo "❌ MinIO: DOWN"
