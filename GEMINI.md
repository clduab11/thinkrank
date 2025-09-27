# Gemini Agent Project Guide: ThinkRank

This document provides a comprehensive overview of the ThinkRank project, its architecture, and development practices to augment Gemini's capabilities.

## 1. Project Overview

ThinkRank is a mobile-first AI literacy game designed to teach users how to identify AI-generated content, understand AI biases, and contribute to AI safety research. It features a gacha-style progression system, various game modes, and a strong focus on ethical, education-first monetization.

- **Core Mission:** To improve AI literacy through engaging gameplay and contribute to AI safety research.
- **Target Platforms:** iOS and Android.
- **Key Features:**
    - Gacha-style progression for learning.
    - Multiple game modes (e.g., Bias Hunter, Mind Maze).
    - Real-time research workflows.
    - Social features and leaderboards.

## 2. Tech Stack

The project uses a modern, microservices-based architecture.

- **Backend:**
    - **Language:** TypeScript (Node.js)
    - **Framework:** Express.js (implied)
    - **Architecture:** Microservices
    - **Services:** Auth, Game, AI, Social, Analytics, Real-time, API Gateway.
- **Frontend (Web):**
    - **Framework:** React
    - **Language:** TypeScript
    - **Build Tool:** Vite
    - **Styling:** Tailwind CSS
    - **State Management:** Redux Toolkit, Zustand
- **Mobile:**
    - **Engine:** Unity
    - **Language:** C#
- **Databases & Caching:**
    - **Primary Database:** PostgreSQL
    - **Caching/In-memory:** Redis
- **API Gateway:** Kong
- **Infrastructure & DevOps:**
    - **Containerization:** Docker
    - **Orchestration:** Kubernetes (k8s)
    - **IaC:** Terraform
    - **CI/CD:** GitHub Actions

## 3. Project Structure

The repository is organized into the following key directories:

- `backend/`: Contains the backend microservices.
    - `services/`: Individual microservices.
    - `shared/`: Shared libraries and types.
- `client/unity-project/`: The Unity mobile client project.
- `frontend/`: The web frontend application.
- `infrastructure/`: DevOps and infrastructure configurations (Docker, k8s, Terraform).
- `docs/`: Project documentation.
- `tests/`: End-to-end and performance tests.
- `scripts/`: Utility and deployment scripts.

## 4. Key Commands

The `Makefile` provides a convenient way to run common tasks.

- `make install`: Install all project dependencies.
- `make dev`: Start the development servers for all services.
- `make test`: Run all unit and integration tests.
- `make build`: Build all services.
- `make docker-up`: Start the Docker containers for the development environment.
- `make docker-down`: Stop the Docker containers.
- `make lint`: Run the linter to check for code quality issues.
- `make format`: Format the codebase using Prettier.

Individual services can be managed using `npm` workspaces, e.g., `npm run dev --workspace=backend/services/auth-service`.

## 5. Development Workflow

1.  **Install dependencies:** `make install`
2.  **Start the development environment:** `make docker-up` followed by `make dev`.
3.  **Make code changes** in the respective service or frontend.
4.  **Run tests** for the modified service (e.g., `make test-auth`).
5.  **Lint and format** your code: `make lint` and `make format`.
6.  **Submit a pull request.**

## 6. Testing

The project has a comprehensive testing strategy:

- **Unit & Integration Tests:** Jest is used for backend services.
- **Frontend Tests:** Vitest and React Testing Library are used for the frontend.
- **Contract Testing:** Pact is used for API contract validation.
- **E2E Tests:** Located in the `tests/e2e` directory.
- **Performance Tests:** K6 is used for load testing, with tests in `tests/performance`.
- **Test Driven Development (TDD):** The project follows the London School of TDD.

## 7. Deployment

- **CI/CD:** GitHub Actions are used for continuous integration and deployment. See `.github/workflows/`.
- **Environments:** The project has configurations for `development`, `staging`, and `production`.
- **Deployment Scripts:** Deployment is handled by scripts in the `scripts/` directory.
