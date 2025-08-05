# Multi-stage Dockerfile for AI Domain Service
# Optimized for production with security and performance considerations

# Build stage
FROM node:20.10.0-alpine3.19 AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies with security audit
RUN npm ci --audit --audit-level moderate

# Copy source code
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20.10.0-alpine3.19 AS production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S ai-service -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies with security audit
RUN npm ci --omit=dev --audit --audit-level moderate && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy migration files
COPY --from=builder /app/src/migrations ./migrations

# Create logs directory and set permissions
RUN mkdir -p logs && \
    chown -R ai-service:nodejs /app

# Security: Run as non-root user with specific UID
USER 1001

# Security hardening - remove unnecessary binaries
RUN rm -rf /usr/local/lib/node_modules/npm && \
    rm -rf /usr/local/bin/npm && \
    rm -rf /usr/local/bin/npx

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3002/health', (res) => { \
        process.exit(res.statusCode === 200 ? 0 : 1) \
    }).on('error', () => process.exit(1))"

# Expose port
EXPOSE 3002

# Environment variables
ENV NODE_ENV=production
ENV PORT=3002

# Start application
CMD ["node", "dist/index.js"]

# Labels for metadata
LABEL service="ai-domain-service"
LABEL version="2.0.0"
LABEL description="Unified AI Domain Service for ThinkRank"
LABEL maintainer="ThinkRank Team"