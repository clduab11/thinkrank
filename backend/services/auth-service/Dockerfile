FROM node:20.10.0-alpine3.19 AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
# Install dependencies with security audit
RUN npm ci --only=production --audit --audit-level moderate && npm cache clean --force

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
# Install all dependencies with security audit for build
RUN npm ci --audit --audit-level moderate

COPY . .
RUN npm run build

# Security scanning stage
FROM aquasec/trivy:latest AS security-scan
WORKDIR /scan
COPY --from=builder /app/dist ./
RUN trivy fs --exit-code 0 --severity HIGH,CRITICAL --no-progress .

# Production image, copy all the files and run the app
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Security hardening - remove unnecessary binaries (before changing user)
RUN rm -rf /usr/local/lib/node_modules/npm && \
    rm -rf /usr/local/bin/npm && \
    rm -rf /usr/local/bin/npx

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

# Copy the standalone output
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json

# Security: Run as non-root user with specific UID
USER 1001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/health', (res) => { \
        process.exit(res.statusCode === 200 ? 0 : 1) \
    }).on('error', () => process.exit(1))"

EXPOSE 3001

ENV PORT 3001
ENV HOSTNAME "0.0.0.0"

# Labels for metadata
LABEL maintainer="ThinkRank Team <dev@thinkrank.com>" \
      version="1.0.0" \
      description="ThinkRank Auth Service" \
      org.opencontainers.image.source="https://github.com/thinkrank/thinkrank" \
      org.opencontainers.image.licenses="MIT"

CMD ["node", "dist/index.js"]