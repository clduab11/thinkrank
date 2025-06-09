.PHONY: help install dev test build docker-up docker-down clean

# Default target
help:
	@echo "ThinkRank Development Commands:"
	@echo "  make install       - Install all dependencies"
	@echo "  make dev          - Start development servers"
	@echo "  make test         - Run all tests"
	@echo "  make test-watch   - Run tests in watch mode"
	@echo "  make build        - Build all services"
	@echo "  make docker-up    - Start Docker containers"
	@echo "  make docker-down  - Stop Docker containers"
	@echo "  make clean        - Clean build artifacts"
	@echo "  make lint         - Run linters"
	@echo "  make format       - Format code"

# Install dependencies
install:
	npm install

# Development
dev:
	npm run dev

# Testing
test:
	npm test

test-watch:
	npm run test:watch

test-auth:
	npm test --workspace=backend/services/auth-service

test-game:
	npm test --workspace=backend/services/game-service

test-ai:
	npm test --workspace=backend/services/ai-service

test-social:
	npm test --workspace=backend/services/social-service

test-integration:
	npm run test:integration

test-e2e:
	npm run test:e2e

# Building
build:
	npm run build

build-auth:
	npm run build --workspace=backend/services/auth-service

build-game:
	npm run build --workspace=backend/services/game-service

build-ai:
	npm run build --workspace=backend/services/ai-service

build-social:
	npm run build --workspace=backend/services/social-service

# Docker
docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

docker-build:
	docker-compose build

docker-logs:
	docker-compose logs -f

docker-clean:
	docker-compose down -v

# Code quality
lint:
	npm run lint

format:
	npm run format

typecheck:
	npm run typecheck

# Database
db-migrate:
	npm run migrate

db-seed:
	npm run seed

db-reset:
	npm run db:reset

# Clean
clean:
	find . -name "node_modules" -type d -prune -exec rm -rf '{}' +
	find . -name "dist" -type d -prune -exec rm -rf '{}' +
	find . -name "coverage" -type d -prune -exec rm -rf '{}' +
	find . -name ".turbo" -type d -prune -exec rm -rf '{}' +

# Production
deploy-staging:
	./scripts/deploy-staging.sh

deploy-production:
	./scripts/deploy-production.sh