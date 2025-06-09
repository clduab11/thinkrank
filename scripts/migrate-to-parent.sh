#!/bin/bash

# ThinkRank Project Migration Script
# Migrates code from claude-code-sparc to parent directory

set -e

echo "🚀 Starting ThinkRank Project Migration"
echo "====================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
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

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

CLAUDE_SPARC_DIR="/Users/chrisdukes/Desktop/projects/thinkrank/claude-code-sparc"
PARENT_DIR="/Users/chrisdukes/Desktop/projects/thinkrank"
BACKUP_DIR="${PARENT_DIR}/backup_$(date +%Y%m%d_%H%M%S)"

# Create backup directory
print_info "Creating backup directory: $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

# Backup existing files in parent that might conflict
echo -e "\n📦 Backing up existing files..."

# List of files to backup if they exist
FILES_TO_BACKUP=(
    "package.json"
    "tsconfig.json"
    "README.md"
    "LICENSE"
    ".gitignore"
    ".prettierrc"
    ".eslintrc.json"
    "docker-compose.yml"
)

for file in "${FILES_TO_BACKUP[@]}"; do
    if [ -f "${PARENT_DIR}/${file}" ]; then
        cp "${PARENT_DIR}/${file}" "${BACKUP_DIR}/"
        print_status "Backed up ${file}"
    fi
done

# Backup directories that might conflict
DIRS_TO_BACKUP=(
    "backend"
    "infrastructure"
    ".github"
)

for dir in "${DIRS_TO_BACKUP[@]}"; do
    if [ -d "${PARENT_DIR}/${dir}" ]; then
        cp -r "${PARENT_DIR}/${dir}" "${BACKUP_DIR}/"
        print_status "Backed up ${dir}/"
    fi
done

echo -e "\n🔀 Merging package.json files..."
# Create merged package.json
node -e "
const fs = require('fs');
const path = require('path');

const parentPkg = JSON.parse(fs.readFileSync('${PARENT_DIR}/package.json', 'utf8'));
const claudePkg = JSON.parse(fs.readFileSync('${CLAUDE_SPARC_DIR}/package.json', 'utf8'));

// Merge scripts
const mergedScripts = {
    ...parentPkg.scripts,
    ...claudePkg.scripts,
    // Keep parent's more comprehensive scripts where they exist
    'dev:backend': parentPkg.scripts['dev:backend'],
    'dev:frontend': 'cd frontend && npm run dev',
    'test:frontend': 'cd frontend && npm test',
    'build:frontend': 'cd frontend && npm run build',
    'test:ai': 'npm test --workspace=backend/services/ai-service',
    'dev:ai': 'npm run dev --workspace=backend/services/ai-service'
};

// Merge devDependencies
const mergedDevDeps = {
    ...parentPkg.devDependencies,
    ...claudePkg.devDependencies
};

// Create merged package.json
const mergedPkg = {
    ...parentPkg,
    scripts: mergedScripts,
    devDependencies: mergedDevDeps,
    workspaces: [
        'backend/services/*',
        'backend/shared/*',
        'frontend'
    ]
};

fs.writeFileSync('${BACKUP_DIR}/package.json.merged', JSON.stringify(mergedPkg, null, 2));
console.log('✓ Created merged package.json');
"

print_status "Created merged package.json"

echo -e "\n📂 Copying files from claude-code-sparc to parent..."

# Copy new files that don't exist in parent
NEW_FILES=(
    "CONTRIBUTING.md"
    "COMMIT_MESSAGE.md"
    "Makefile"
    "architecture-design.md"
    "pseudocode-design.md"
    "research-findings.md"
    "specifications.md"
    "sparc-memory.md"
    "optional-coordination-system.md"
    "*claude.md"
    "claude-sparc.sh"
)

for file in "${NEW_FILES[@]}"; do
    if [ -f "${CLAUDE_SPARC_DIR}/${file}" ]; then
        cp "${CLAUDE_SPARC_DIR}/${file}" "${PARENT_DIR}/"
        print_status "Copied ${file}"
    fi
done

# Copy directories
echo -e "\n📁 Copying directories..."

# Copy frontend directory (new)
if [ -d "${CLAUDE_SPARC_DIR}/frontend" ]; then
    cp -r "${CLAUDE_SPARC_DIR}/frontend" "${PARENT_DIR}/"
    print_status "Copied frontend/"
fi

# Copy scripts directory
if [ -d "${CLAUDE_SPARC_DIR}/scripts" ]; then
    cp -r "${CLAUDE_SPARC_DIR}/scripts" "${PARENT_DIR}/"
    print_status "Copied scripts/"
fi

# Copy docs directory
if [ -d "${CLAUDE_SPARC_DIR}/docs" ]; then
    cp -r "${CLAUDE_SPARC_DIR}/docs" "${PARENT_DIR}/"
    print_status "Copied docs/"
fi

# Merge backend services
echo -e "\n🔀 Merging backend services..."

# Copy AI service (new)
if [ -d "${CLAUDE_SPARC_DIR}/backend/services/ai-service" ]; then
    cp -r "${CLAUDE_SPARC_DIR}/backend/services/ai-service" "${PARENT_DIR}/backend/services/"
    print_status "Copied ai-service"
fi

# Copy shared types
if [ -d "${CLAUDE_SPARC_DIR}/backend/shared/types" ]; then
    cp -r "${CLAUDE_SPARC_DIR}/backend/shared/types" "${PARENT_DIR}/backend/shared/"
    print_status "Copied shared types"
fi

# Merge infrastructure
echo -e "\n🔀 Merging infrastructure..."

# Copy k8s configs
if [ -d "${CLAUDE_SPARC_DIR}/infrastructure/k8s" ]; then
    mkdir -p "${PARENT_DIR}/infrastructure"
    cp -r "${CLAUDE_SPARC_DIR}/infrastructure/k8s" "${PARENT_DIR}/infrastructure/"
    print_status "Copied k8s configurations"
fi

# Copy monitoring configs
if [ -d "${CLAUDE_SPARC_DIR}/infrastructure/monitoring" ]; then
    cp -r "${CLAUDE_SPARC_DIR}/infrastructure/monitoring" "${PARENT_DIR}/infrastructure/"
    print_status "Copied monitoring configurations"
fi

# Copy logging configs
if [ -d "${CLAUDE_SPARC_DIR}/infrastructure/logging" ]; then
    cp -r "${CLAUDE_SPARC_DIR}/infrastructure/logging" "${PARENT_DIR}/infrastructure/"
    print_status "Copied logging configurations"
fi

# Apply merged package.json
echo -e "\n📝 Applying merged configurations..."
cp "${BACKUP_DIR}/package.json.merged" "${PARENT_DIR}/package.json"
print_status "Applied merged package.json"

# Copy other config files
cp "${CLAUDE_SPARC_DIR}/.eslintrc.json" "${PARENT_DIR}/"
cp "${CLAUDE_SPARC_DIR}/.prettierrc" "${PARENT_DIR}/"
cp "${CLAUDE_SPARC_DIR}/docker-compose.yml" "${PARENT_DIR}/docker-compose.dev.yml"
print_status "Copied configuration files"

echo -e "\n✅ Migration complete!"
echo -e "\n📊 Summary:"
echo "  - Backup created at: $BACKUP_DIR"
echo "  - Files migrated from: $CLAUDE_SPARC_DIR"
echo "  - Files migrated to: $PARENT_DIR"

echo -e "\n🔍 Next steps:"
echo "  1. Review the merged files"
echo "  2. Update any remaining paths in the code"
echo "  3. Run tests to ensure everything works"
echo "  4. Remove the claude-code-sparc directory when confirmed"