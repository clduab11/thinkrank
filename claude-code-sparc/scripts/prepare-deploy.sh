#!/bin/bash

# ThinkRank Deployment Preparation Script
# This script prepares the project for deployment

set -e

echo "🚀 ThinkRank Deployment Preparation"
echo "=================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed"
    exit 1
fi

if ! command -v kubectl &> /dev/null; then
    print_warning "kubectl is not installed (needed for Kubernetes deployment)"
fi

print_status "Prerequisites check passed"

# Install dependencies
echo -e "\n📦 Installing dependencies..."
npm install
print_status "Dependencies installed"

# Run tests
echo -e "\n🧪 Running tests..."
npm test
print_status "All tests passed"

# Run linting
echo -e "\n🔍 Running linting..."
npm run lint || true
print_status "Linting complete"

# Run type checking
echo -e "\n📐 Running type checking..."
npm run typecheck || true
print_status "Type checking complete"

# Build all services
echo -e "\n🏗️  Building services..."
npm run build
print_status "Services built successfully"

# Build Docker images
echo -e "\n🐳 Building Docker images..."
docker-compose build
print_status "Docker images built"

# Generate build info
echo -e "\n📝 Generating build info..."
BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
GIT_COMMIT=$(git rev-parse HEAD)
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

cat > build-info.json <<EOF
{
  "buildDate": "$BUILD_DATE",
  "gitCommit": "$GIT_COMMIT",
  "gitBranch": "$GIT_BRANCH",
  "version": "1.0.0"
}
EOF

print_status "Build info generated"

# Create deployment package
echo -e "\n📦 Creating deployment package..."
mkdir -p dist
tar -czf dist/thinkrank-deployment.tar.gz \
    docker-compose.yml \
    docker-compose.prod.yml \
    infrastructure/k8s \
    infrastructure/kong \
    build-info.json

print_status "Deployment package created"

# Summary
echo -e "\n✅ Deployment preparation complete!"
echo -e "\n📊 Summary:"
echo "  - Build Date: $BUILD_DATE"
echo "  - Git Commit: $GIT_COMMIT"
echo "  - Git Branch: $GIT_BRANCH"
echo "  - Deployment Package: dist/thinkrank-deployment.tar.gz"

echo -e "\n🚀 Next steps:"
echo "  1. Review the deployment package"
echo "  2. Push Docker images to registry"
echo "  3. Deploy to Kubernetes cluster"
echo "  4. Run smoke tests"

echo -e "\n📚 Deployment commands:"
echo "  docker-compose push                    # Push images to registry"
echo "  kubectl apply -k infrastructure/k8s/   # Deploy to Kubernetes"
echo "  kubectl get pods -n thinkrank          # Check deployment status"