# Build stage
FROM node:20.10.0-alpine3.19 AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with security audit
RUN npm ci --audit --audit-level moderate

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Security scanning stage
FROM aquasec/trivy:latest AS security-scan
WORKDIR /scan
COPY --from=builder /app/dist ./
RUN trivy fs --exit-code 0 --severity HIGH,CRITICAL --no-progress .

# Production stage
FROM nginx:1.25-alpine

# Copy custom nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built application from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /var/cache/nginx && \
    chown -R nodejs:nodejs /var/log/nginx && \
    chown -R nodejs:nodejs /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nodejs:nodejs /var/run/nginx.pid

# Security: Run as non-root user with specific UID
USER 1001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

EXPOSE 8080

# Labels for metadata
LABEL maintainer="ThinkRank Team <dev@thinkrank.com>" \
      version="1.0.0" \
      description="ThinkRank Frontend Application" \
      org.opencontainers.image.source="https://github.com/thinkrank/thinkrank" \
      org.opencontainers.image.licenses="MIT"

CMD ["nginx", "-g", "daemon off;"]