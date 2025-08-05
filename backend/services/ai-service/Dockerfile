FROM node:20.10.0-alpine3.19 AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies with security audit
RUN npm ci --audit --audit-level moderate

# Copy source code
COPY src ./src

# Build the application
RUN npm run build

# Security scanning stage
FROM aquasec/trivy:latest AS security-scan
WORKDIR /scan
COPY --from=builder /app/dist ./
RUN trivy fs --exit-code 0 --severity HIGH,CRITICAL --no-progress .

# Production stage
FROM node:20.10.0-alpine3.19

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies with security audit
RUN npm ci --only=production --audit --audit-level moderate && npm cache clean --force

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app

# Security: Run as non-root user with specific UID
USER 1001

# Security hardening - remove unnecessary binaries
RUN rm -rf /usr/local/lib/node_modules/npm && \
    rm -rf /usr/local/bin/npm && \
    rm -rf /usr/local/bin/npx

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3003/health', (res) => { \
        process.exit(res.statusCode === 200 ? 0 : 1) \
    }).on('error', () => process.exit(1))"

EXPOSE 3003

# Labels for metadata
LABEL maintainer="ThinkRank Team <dev@thinkrank.com>" \
      version="1.0.0" \
      description="ThinkRank AI Service" \
      org.opencontainers.image.source="https://github.com/thinkrank/thinkrank" \
      org.opencontainers.image.licenses="MIT"

CMD ["node", "dist/index.js"]