# ThinkRank Deployment Guide

## 🚀 Production Deployment Overview

This guide provides comprehensive instructions for deploying ThinkRank to production environments, ensuring scalability, security, and reliability.

## 📋 Prerequisites

### Infrastructure Requirements
- Kubernetes cluster (v1.24+)
- Supabase instance (PostgreSQL database)
- Redis cluster for caching
- AWS/GCP/Azure cloud provider
- Domain name and SSL certificates
- CDN setup (CloudFront/CloudFlare)

### External Services
- Stripe for payment processing
- SendGrid for email delivery
- Firebase for push notifications
- Sentry for error tracking
- DataDog/New Relic for monitoring

## 🔧 Deployment Steps

### 1. Environment Configuration

```bash
# Copy and configure production environment
cp deployment/production/env.production.template .env.production

# Edit configuration with actual values
vim .env.production
```

Key configurations to set:
- Database connection strings
- API keys for external services
- SSL certificate paths
- JWT secrets and encryption keys
- Payment processor credentials

### 2. Database Setup

```bash
# Run database migrations
npm run db:migrate:production

# Seed initial data
npm run db:seed:production

# Verify database connectivity
npm run db:health-check
```

### 3. Backend Services Deployment

```bash
# Build and deploy all microservices
kubectl apply -f infrastructure/kubernetes/

# Deploy individual services
kubectl apply -f infrastructure/kubernetes/auth-service.yaml
kubectl apply -f infrastructure/kubernetes/game-service.yaml
kubectl apply -f infrastructure/kubernetes/social-service.yaml
kubectl apply -f infrastructure/kubernetes/ai-research-service.yaml
kubectl apply -f infrastructure/kubernetes/analytics-service.yaml

# Verify deployments
kubectl get pods -n thinkrank-production
kubectl get services -n thinkrank-production
```

### 4. Unity Client Build

```bash
# iOS Build
cd client/build-scripts
./build-ios.sh --production

# Android Build
./build-android.sh --production

# Verify builds
ls -la builds/
```

### 5. Monitoring & Analytics Setup

```bash
# Deploy monitoring stack
kubectl apply -f infrastructure/monitoring/

# Configure alerting
kubectl apply -f infrastructure/monitoring/alerts.yaml

# Set up dashboards
kubectl apply -f infrastructure/monitoring/dashboards.yaml
```

## 🧪 Testing in Production

### Pre-Launch Testing
```bash
# Run performance tests
npm run test:performance

# Execute end-to-end tests
npm run test:e2e:production

# Validate security
npm run security:scan

# Test load balancing
npm run test:load
```

### Health Checks
```bash
# Verify all services are healthy
curl https://api.thinkrank.app/health
curl https://auth.thinkrank.app/health
curl https://game.thinkrank.app/health
curl https://social.thinkrank.app/health
curl https://analytics.thinkrank.app/health
```

## 📱 App Store Deployment

### iOS App Store

1. **Prepare Build**
   ```bash
   cd client/unity-project
   # Build for iOS with production settings
   Unity -batchmode -projectPath . -buildTarget iOS -quit
   ```

2. **App Store Connect**
   - Upload build using Xcode or Application Loader
   - Configure metadata from `deployment/app-store/ios/metadata.json`
   - Submit for review

3. **Release Management**
   - Monitor review status
   - Prepare for phased rollout
   - Configure App Store optimization

### Google Play Store

1. **Prepare Build**
   ```bash
   cd client/unity-project
   # Build Android App Bundle
   Unity -batchmode -projectPath . -buildTarget Android -quit
   ```

2. **Play Console**
   - Upload AAB to Play Console
   - Configure metadata from `deployment/app-store/android/play-store-metadata.json`
   - Set up staged rollout (5% → 100%)

3. **Release Management**
   - Monitor crash reports and ANRs
   - Track user feedback and ratings
   - Manage rollout percentage

## 📊 Monitoring & Alerting

### Key Metrics to Monitor

1. **Application Performance**
   - API response times (<200ms target)
   - Error rates (<1% target)
   - Throughput (requests per second)
   - Database query performance

2. **Business Metrics**
   - User registration rate
   - Game completion rates
   - Subscription conversions
   - Revenue tracking

3. **System Health**
   - CPU and memory usage
   - Disk I/O and network
   - Database connections
   - Cache hit rates

### Alert Configuration

```yaml
# Example alert rules
groups:
  - name: thinkrank-alerts
    rules:
      - alert: HighErrorRate
        expr: error_rate > 0.05
        for: 5m
        annotations:
          summary: "High error rate detected"

      - alert: SlowResponseTime
        expr: avg_response_time > 200
        for: 3m
        annotations:
          summary: "API response time too slow"
```

## 🔒 Security Considerations

### SSL/TLS Configuration
- Use TLS 1.3 for all connections
- Implement HSTS headers
- Configure proper cipher suites
- Regular certificate renewal

### API Security
- Rate limiting per endpoint
- Input validation and sanitization
- SQL injection protection
- XSS prevention headers

### Data Protection
- Encryption at rest and in transit
- Regular security audits
- GDPR compliance measures
- Data retention policies

## 🔄 Continuous Deployment

### CI/CD Pipeline

```yaml
# .github/workflows/deploy-production.yml
name: Production Deployment
on:
  push:
    branches: [main]
    tags: ['v*']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
      - name: Run tests
      - name: Build services
      - name: Deploy to production
      - name: Run smoke tests
      - name: Notify team
```

### Blue-Green Deployment

1. **Deploy to Green Environment**
   ```bash
   kubectl apply -f infrastructure/kubernetes/ --namespace=thinkrank-green
   ```

2. **Validate Green Environment**
   ```bash
   npm run test:smoke --environment=green
   ```

3. **Switch Traffic**
   ```bash
   kubectl patch service thinkrank-lb -p '{"spec":{"selector":{"version":"green"}}}'
   ```

4. **Monitor and Rollback if Needed**
   ```bash
   # If issues detected, rollback immediately
   kubectl patch service thinkrank-lb -p '{"spec":{"selector":{"version":"blue"}}}'
   ```

## 🆘 Disaster Recovery

### Backup Procedures
```bash
# Database backup
pg_dump -h your-db-host -U username thinkrank_prod > backup_$(date +%Y%m%d).sql

# Upload to secure storage
aws s3 cp backup_$(date +%Y%m%d).sql s3://thinkrank-backups/
```

### Recovery Procedures
```bash
# Restore from backup
psql -h your-db-host -U username -d thinkrank_prod < backup_20241201.sql

# Verify data integrity
npm run db:verify
```

### Failover Process
1. Detect failure via monitoring
2. Trigger automatic failover to backup region
3. Update DNS to point to backup
4. Notify operations team
5. Investigate and resolve primary issue

## 📈 Scaling Guidelines

### Horizontal Scaling
```yaml
# Auto-scaling configuration
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: thinkrank-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: thinkrank-api
  minReplicas: 3
  maxReplicas: 50
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### Database Scaling
- Read replicas for analytics queries
- Connection pooling optimization
- Query performance monitoring
- Index optimization

## 🔍 Troubleshooting

### Common Issues

1. **High CPU Usage**
   ```bash
   kubectl top pods -n thinkrank-production
   kubectl describe pod <pod-name>
   ```

2. **Database Connection Issues**
   ```bash
   kubectl logs -f deployment/auth-service | grep database
   ```

3. **Memory Leaks**
   ```bash
   kubectl exec -it <pod-name> -- top
   ```

### Log Analysis
```bash
# Centralized logging with ELK stack
kubectl logs -f deployment/analytics-service | grep ERROR

# Search specific errors
elasticsearch-query "error_type:network_timeout AND timestamp:[now-1h TO now]"
```

## 📞 Support Contacts

### Emergency Escalation
1. **Level 1**: On-call engineer (PagerDuty)
2. **Level 2**: Technical lead
3. **Level 3**: Engineering manager
4. **Level 4**: CTO

### Service Providers
- **AWS Support**: [Support Case URL]
- **Supabase Support**: support@supabase.io
- **Stripe Support**: [Dashboard URL]

---

**Document Version**: 1.0.0
**Last Updated**: December 2024
**Next Review**: March 2025

For questions or updates to this guide, contact: devops@thinkrank.app
