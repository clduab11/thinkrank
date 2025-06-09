# ThinkRank Detailed Architecture Design

## 1. Component Architecture

### 1.1 Frontend Components

```typescript
// Component Hierarchy
ThinkRankApp/
├── Core/
│   ├── Layout/
│   │   ├── AppShell.tsx
│   │   ├── Navigation.tsx
│   │   └── Footer.tsx
│   ├── Auth/
│   │   ├── LoginForm.tsx
│   │   ├── RegisterForm.tsx
│   │   └── AuthProvider.tsx
│   └── Common/
│       ├── Button.tsx
│       ├── Card.tsx
│       └── Modal.tsx
├── Game/
│   ├── GameBoard/
│   │   ├── GameContainer.tsx
│   │   ├── ChallengeDisplay.tsx
│   │   └── TimerDisplay.tsx
│   ├── Scoring/
│   │   ├── ScoreDisplay.tsx
│   │   ├── ComboMeter.tsx
│   │   └── XPProgress.tsx
│   └── Detection/
│       ├── TextDetector.tsx
│       ├── ImageDetector.tsx
│       └── FeedbackModal.tsx
├── Social/
│   ├── Leaderboard/
│   │   ├── LeaderboardContainer.tsx
│   │   ├── LeaderboardEntry.tsx
│   │   └── FilterControls.tsx
│   ├── Friends/
│   │   ├── FriendsList.tsx
│   │   └── FriendInvite.tsx
│   └── Guild/
│       ├── GuildDashboard.tsx
│       └── GuildMembers.tsx
└── Profile/
    ├── UserProfile.tsx
    ├── AchievementGrid.tsx
    └── StatsDisplay.tsx
```

### 1.2 Backend Service Architecture

```yaml
# Service Definitions
services:
  auth-service:
    port: 3001
    dependencies:
      - postgres
      - redis
    endpoints:
      - POST /register
      - POST /login
      - POST /logout
      - POST /refresh
      - GET /verify-email/:token
      - POST /oauth/:provider
    middleware:
      - rateLimiter
      - validator
      - errorHandler

  game-service:
    port: 3002
    dependencies:
      - postgres
      - redis
      - ai-service
    endpoints:
      - POST /start
      - GET /:gameId
      - POST /:gameId/submit
      - POST /:gameId/complete
      - GET /modes
      - GET /history
    middleware:
      - authenticate
      - gameValidator
      - errorHandler

  ai-service:
    port: 3003
    runtime: python
    framework: fastapi
    dependencies:
      - tensorflow
      - torch
      - redis
    endpoints:
      - POST /detect/text
      - POST /detect/image
      - GET /models
      - POST /feedback
    models:
      - gpt-detector-v1
      - image-gan-detector-v1
      - style-analyzer-v1

  social-service:
    port: 3004
    dependencies:
      - postgres
      - redis
      - supabase
    endpoints:
      - GET /leaderboard/:type
      - GET /friends
      - POST /friends/add
      - GET /guilds
      - POST /guilds/create
      - POST /guilds/:id/join
    realtime:
      - leaderboard-updates
      - friend-activity
      - guild-chat

  analytics-service:
    port: 3005
    dependencies:
      - clickhouse
      - redis
    endpoints:
      - POST /events
      - GET /metrics/user/:userId
      - GET /metrics/game/:gameId
      - GET /reports/research
    scheduled:
      - aggregateMetrics: "*/5 * * * *"
      - generateReports: "0 0 * * *"
```

### 1.3 Dependency Injection Configuration

```typescript
// Container configuration
import { Container } from 'inversify';

// Types
const TYPES = {
  Database: Symbol.for('Database'),
  Cache: Symbol.for('Cache'),
  Logger: Symbol.for('Logger'),
  AuthService: Symbol.for('AuthService'),
  GameService: Symbol.for('GameService'),
  AIService: Symbol.for('AIService'),
  EventBus: Symbol.for('EventBus'),
};

// Container setup
const container = new Container();

// Infrastructure bindings
container.bind(TYPES.Database).to(PostgresDatabase).inSingletonScope();
container.bind(TYPES.Cache).to(RedisCache).inSingletonScope();
container.bind(TYPES.Logger).to(WinstonLogger).inSingletonScope();
container.bind(TYPES.EventBus).to(EventEmitterBus).inSingletonScope();

// Service bindings
container.bind(TYPES.AuthService).to(AuthService).inSingletonScope();
container.bind(TYPES.GameService).to(GameService).inSingletonScope();
container.bind(TYPES.AIService).to(AIServiceClient).inSingletonScope();

// Factory patterns
container.bind<interfaces.Factory<GameSession>>(
  'Factory<GameSession>'
).toFactory<GameSession>((context) => {
  return (userId: string, mode: GameMode) => {
    const logger = context.container.get(TYPES.Logger);
    const cache = context.container.get(TYPES.Cache);
    return new GameSession(userId, mode, logger, cache);
  };
});
```

## 2. Data Architecture

### 2.1 Database Schema

```sql
-- Core user tables
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    avatar_url VARCHAR(500),
    role VARCHAR(20) DEFAULT 'player',
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    email_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE user_auth (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    provider_id VARCHAR(255) NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    expires_at TIMESTAMP,
    PRIMARY KEY (user_id, provider)
);

-- Game-related tables
CREATE TABLE games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    mode VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    score INTEGER DEFAULT 0,
    accuracy DECIMAL(3,2),
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    duration_seconds INTEGER,
    metadata JSONB
);

CREATE TABLE challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    is_ai_generated BOOLEAN NOT NULL,
    difficulty DECIMAL(2,1) CHECK (difficulty >= 0 AND difficulty <= 1),
    source_info JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE game_challenges (
    game_id UUID REFERENCES games(id) ON DELETE CASCADE,
    challenge_id UUID REFERENCES challenges(id),
    position INTEGER NOT NULL,
    presented_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (game_id, challenge_id)
);

CREATE TABLE challenge_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID REFERENCES games(id) ON DELETE CASCADE,
    challenge_id UUID REFERENCES challenges(id),
    user_answer BOOLEAN NOT NULL,
    is_correct BOOLEAN NOT NULL,
    time_spent_seconds INTEGER NOT NULL,
    score_earned INTEGER NOT NULL,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Achievement system
CREATE TABLE achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    icon_url VARCHAR(500),
    category VARCHAR(50),
    points INTEGER DEFAULT 10,
    criteria JSONB NOT NULL
);

CREATE TABLE user_achievements (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    achievement_id UUID REFERENCES achievements(id),
    unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, achievement_id)
);

-- Social features
CREATE TABLE friendships (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    friend_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, friend_id),
    CHECK (user_id != friend_id)
);

CREATE TABLE guilds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    icon_url VARCHAR(500),
    owner_id UUID REFERENCES users(id),
    max_members INTEGER DEFAULT 50,
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE guild_members (
    guild_id UUID REFERENCES guilds(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guild_id, user_id)
);

-- Leaderboards (using Redis, but backup in PostgreSQL)
CREATE TABLE leaderboard_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL,
    timeframe VARCHAR(20) NOT NULL,
    snapshot_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Research data
CREATE TABLE research_consent (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    version VARCHAR(20) NOT NULL,
    accepted BOOLEAN NOT NULL,
    ip_address INET,
    user_agent TEXT,
    consented_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, version)
);

CREATE TABLE research_contributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    game_id UUID REFERENCES games(id) ON DELETE CASCADE,
    data JSONB NOT NULL,
    anonymized BOOLEAN DEFAULT FALSE,
    exported BOOLEAN DEFAULT FALSE,
    contributed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_games_user_id ON games(user_id);
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_challenges_type ON challenges(type);
CREATE INDEX idx_challenge_responses_game ON challenge_responses(game_id);
CREATE INDEX idx_friendships_user ON friendships(user_id);
CREATE INDEX idx_friendships_friend ON friendships(friend_id);
CREATE INDEX idx_guild_members_user ON guild_members(user_id);
CREATE INDEX idx_research_contributions_user ON research_contributions(user_id);
```

### 2.2 Redis Data Structures

```typescript
// Cache patterns and data structures
interface RedisSchemas {
  // User sessions
  'session:{userId}': {
    token: string;
    refreshToken: string;
    expiresAt: number;
  };

  // Active games
  'game:{gameId}': {
    userId: string;
    mode: string;
    currentChallenge: number;
    score: number;
    streak: number;
    startTime: number;
  };

  // Leaderboards (Sorted Sets)
  'leaderboard:global': SortedSet<userId, score>;
  'leaderboard:daily': SortedSet<userId, score>;
  'leaderboard:weekly': SortedSet<userId, score>;
  'leaderboard:mode:{mode}': SortedSet<userId, score>;

  // User stats (Hashes)
  'stats:{userId}': {
    totalGames: string;
    totalScore: string;
    bestStreak: string;
    accuracy: string;
    lastPlayed: string;
  };

  // Rate limiting (Strings with TTL)
  'ratelimit:{ip}:{endpoint}': number;

  // Real-time presence (Sets)
  'online:users': Set<userId>;
  'room:{roomId}:users': Set<userId>;

  // Challenge pool (Lists)
  'challenges:text:easy': List<challengeId>;
  'challenges:text:medium': List<challengeId>;
  'challenges:text:hard': List<challengeId>;
  'challenges:image:easy': List<challengeId>;
  'challenges:image:medium': List<challengeId>;
  'challenges:image:hard': List<challengeId>;
}
```

### 2.3 Data Access Patterns

```typescript
// Repository implementations
class UserRepository implements IUserRepository {
  constructor(
    private db: Pool,
    private cache: Redis
  ) {}

  async findById(id: string): Promise<User | null> {
    // Try cache first
    const cached = await this.cache.get(`user:${id}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // Query database
    const result = await this.db.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const user = this.mapToUser(result.rows[0]);
    
    // Cache for 5 minutes
    await this.cache.setex(
      `user:${id}`,
      300,
      JSON.stringify(user)
    );

    return user;
  }

  async updateStats(userId: string, stats: Partial<UserStats>): Promise<void> {
    // Update in Redis for real-time access
    const pipeline = this.cache.pipeline();
    
    Object.entries(stats).forEach(([key, value]) => {
      pipeline.hset(`stats:${userId}`, key, value.toString());
    });
    
    await pipeline.exec();

    // Async update to PostgreSQL
    setImmediate(async () => {
      await this.db.query(
        `UPDATE users 
         SET xp = xp + $1, 
             level = CASE 
               WHEN xp + $1 >= level * 100 THEN level + 1 
               ELSE level 
             END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [stats.xpGained || 0, userId]
      );
    });
  }
}

// Caching strategies
class CacheManager {
  constructor(private redis: Redis) {}

  // Cache-aside pattern
  async cacheAside<T>(
    key: string,
    ttl: number,
    fetchFn: () => Promise<T>
  ): Promise<T> {
    const cached = await this.redis.get(key);
    if (cached) {
      return JSON.parse(cached);
    }

    const data = await fetchFn();
    await this.redis.setex(key, ttl, JSON.stringify(data));
    return data;
  }

  // Write-through pattern
  async writeThrough<T>(
    key: string,
    ttl: number,
    data: T,
    persistFn: (data: T) => Promise<void>
  ): Promise<void> {
    // Write to cache
    await this.redis.setex(key, ttl, JSON.stringify(data));
    
    // Write to persistent storage
    await persistFn(data);
  }

  // Cache invalidation
  async invalidate(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
```

## 3. Infrastructure Architecture

### 3.1 Kubernetes Deployment

```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: thinkrank

---
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: thinkrank-config
  namespace: thinkrank
data:
  NODE_ENV: "production"
  API_GATEWAY_URL: "https://api.thinkrank.com"
  REDIS_CLUSTER: "redis-cluster.thinkrank.svc.cluster.local:6379"

---
# auth-service-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-service
  namespace: thinkrank
spec:
  replicas: 3
  selector:
    matchLabels:
      app: auth-service
  template:
    metadata:
      labels:
        app: auth-service
    spec:
      containers:
      - name: auth-service
        image: thinkrank/auth-service:latest
        ports:
        - containerPort: 3001
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: url
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: jwt-secret
              key: secret
        - name: REDIS_URL
          valueFrom:
            configMapKeyRef:
              name: thinkrank-config
              key: REDIS_CLUSTER
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5

---
# game-service-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: game-service
  namespace: thinkrank
spec:
  replicas: 5
  selector:
    matchLabels:
      app: game-service
  template:
    metadata:
      labels:
        app: game-service
    spec:
      containers:
      - name: game-service
        image: thinkrank/game-service:latest
        ports:
        - containerPort: 3002
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: url
        - name: AI_SERVICE_URL
          value: "http://ai-service:3003"
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"

---
# horizontal-pod-autoscaler.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: game-service-hpa
  namespace: thinkrank
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: game-service
  minReplicas: 5
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100
        periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60

---
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: thinkrank-ingress
  namespace: thinkrank
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
spec:
  tls:
  - hosts:
    - api.thinkrank.com
    secretName: thinkrank-tls
  rules:
  - host: api.thinkrank.com
    http:
      paths:
      - path: /auth
        pathType: Prefix
        backend:
          service:
            name: auth-service
            port:
              number: 3001
      - path: /games
        pathType: Prefix
        backend:
          service:
            name: game-service
            port:
              number: 3002
      - path: /ai
        pathType: Prefix
        backend:
          service:
            name: ai-service
            port:
              number: 3003
      - path: /social
        pathType: Prefix
        backend:
          service:
            name: social-service
            port:
              number: 3004
```

### 3.2 Terraform Infrastructure

```hcl
# main.tf
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  backend "s3" {
    bucket = "thinkrank-terraform-state"
    key    = "infrastructure/terraform.tfstate"
    region = "us-east-1"
  }
}

# VPC Configuration
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
  
  name = "thinkrank-vpc"
  cidr = "10.0.0.0/16"
  
  azs             = ["us-east-1a", "us-east-1b", "us-east-1c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
  
  enable_nat_gateway = true
  enable_vpn_gateway = true
  
  tags = {
    Environment = "production"
    Project     = "thinkrank"
  }
}

# EKS Cluster
module "eks" {
  source = "terraform-aws-modules/eks/aws"
  
  cluster_name    = "thinkrank-cluster"
  cluster_version = "1.28"
  
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets
  
  eks_managed_node_groups = {
    general = {
      desired_capacity = 3
      min_capacity     = 3
      max_capacity     = 10
      
      instance_types = ["t3.large"]
      
      k8s_labels = {
        Environment = "production"
        NodeGroup   = "general"
      }
    }
    
    game = {
      desired_capacity = 5
      min_capacity     = 5
      max_capacity     = 20
      
      instance_types = ["c5.xlarge"]
      
      k8s_labels = {
        Environment = "production"
        NodeGroup   = "game"
      }
      
      taints = [{
        key    = "game"
        value  = "true"
        effect = "NO_SCHEDULE"
      }]
    }
  }
}

# RDS PostgreSQL
module "rds" {
  source = "terraform-aws-modules/rds/aws"
  
  identifier = "thinkrank-postgres"
  
  engine            = "postgres"
  engine_version    = "15.4"
  instance_class    = "db.r6g.large"
  allocated_storage = 100
  
  db_name  = "thinkrank"
  username = "thinkrank_admin"
  port     = "5432"
  
  vpc_security_group_ids = [aws_security_group.rds.id]
  
  create_db_subnet_group = true
  subnet_ids             = module.vpc.private_subnets
  
  backup_retention_period = 30
  backup_window          = "03:00-06:00"
  
  enabled_cloudwatch_logs_exports = ["postgresql"]
  
  deletion_protection = true
}

# ElastiCache Redis Cluster
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "thinkrank-redis"
  replication_group_description = "Redis cluster for ThinkRank"
  
  engine               = "redis"
  node_type            = "cache.r6g.large"
  number_cache_clusters = 3
  port                 = 6379
  
  subnet_group_name = aws_elasticache_subnet_group.redis.name
  security_group_ids = [aws_security_group.redis.id]
  
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  
  automatic_failover_enabled = true
  multi_az_enabled          = true
  
  snapshot_retention_limit = 7
  snapshot_window         = "03:00-05:00"
}

# S3 Buckets
resource "aws_s3_bucket" "media" {
  bucket = "thinkrank-media"
  
  tags = {
    Environment = "production"
    Purpose     = "media-storage"
  }
}

resource "aws_s3_bucket_versioning" "media" {
  bucket = aws_s3_bucket.media.id
  
  versioning_configuration {
    status = "Enabled"
  }
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "cdn" {
  origin {
    domain_name = aws_s3_bucket.media.bucket_regional_domain_name
    origin_id   = "S3-thinkrank-media"
    
    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.media.cloudfront_access_identity_path
    }
  }
  
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  
  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-thinkrank-media"
    
    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
    
    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }
  
  price_class = "PriceClass_200"
  
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
  
  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

# WAF for API Protection
resource "aws_wafv2_web_acl" "api_protection" {
  name  = "thinkrank-api-waf"
  scope = "REGIONAL"
  
  default_action {
    allow {}
  }
  
  rule {
    name     = "RateLimitRule"
    priority = 1
    
    action {
      block {}
    }
    
    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }
    
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimitRule"
      sampled_requests_enabled   = true
    }
  }
  
  rule {
    name     = "SQLiRule"
    priority = 2
    
    action {
      block {}
    }
    
    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesSQLiRuleSet"
      }
    }
    
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "SQLiRule"
      sampled_requests_enabled   = true
    }
  }
}
```

### 3.3 CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  AWS_REGION: us-east-1
  ECR_REPOSITORY: thinkrank
  EKS_CLUSTER_NAME: thinkrank-cluster

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: [auth-service, game-service, social-service]
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        working-directory: ./backend/services/${{ matrix.service }}
        run: npm ci
      
      - name: Run tests
        working-directory: ./backend/services/${{ matrix.service }}
        run: npm test -- --coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./backend/services/${{ matrix.service }}/coverage/lcov.info
          flags: ${{ matrix.service }}

  build-and-push:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    strategy:
      matrix:
        service: [auth-service, game-service, social-service, ai-service]
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
      
      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v1
      
      - name: Build and push Docker image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY/${{ matrix.service }}:$IMAGE_TAG \
            -f ./backend/services/${{ matrix.service }}/Dockerfile \
            ./backend/services/${{ matrix.service }}
          docker push $ECR_REGISTRY/$ECR_REPOSITORY/${{ matrix.service }}:$IMAGE_TAG
          docker tag $ECR_REGISTRY/$ECR_REPOSITORY/${{ matrix.service }}:$IMAGE_TAG \
            $ECR_REGISTRY/$ECR_REPOSITORY/${{ matrix.service }}:latest
          docker push $ECR_REGISTRY/$ECR_REPOSITORY/${{ matrix.service }}:latest

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
      
      - name: Update kubeconfig
        run: |
          aws eks update-kubeconfig --name ${{ env.EKS_CLUSTER_NAME }} --region ${{ env.AWS_REGION }}
      
      - name: Deploy to Kubernetes
        run: |
          kubectl apply -k ./infrastructure/kubernetes/overlays/production
          kubectl rollout status deployment -n thinkrank --timeout=300s
```

## 4. Monitoring and Observability

### 4.1 Prometheus Configuration

```yaml
# prometheus-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
  namespace: monitoring
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
      evaluation_interval: 15s
    
    scrape_configs:
      - job_name: 'kubernetes-apiservers'
        kubernetes_sd_configs:
        - role: endpoints
        scheme: https
        tls_config:
          ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
        bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
        relabel_configs:
        - source_labels: [__meta_kubernetes_namespace, __meta_kubernetes_service_name, __meta_kubernetes_endpoint_port_name]
          action: keep
          regex: default;kubernetes;https
      
      - job_name: 'thinkrank-services'
        kubernetes_sd_configs:
        - role: pod
          namespaces:
            names:
            - thinkrank
        relabel_configs:
        - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
          action: keep
          regex: true
        - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
          action: replace
          target_label: __metrics_path__
          regex: (.+)
        - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
          action: replace
          regex: ([^:]+)(?::\d+)?;(\d+)
          replacement: $1:$2
          target_label: __address__
    
    alerting:
      alertmanagers:
      - static_configs:
        - targets:
          - alertmanager:9093
    
    rule_files:
      - '/etc/prometheus/alerts/*.yml'
```

### 4.2 Grafana Dashboards

```json
{
  "dashboard": {
    "title": "ThinkRank Service Metrics",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total[5m])) by (service)"
          }
        ]
      },
      {
        "title": "Response Time (p95)",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (service, le))"
          }
        ]
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{status=~\"5..\"}[5m])) by (service)"
          }
        ]
      },
      {
        "title": "Active Games",
        "targets": [
          {
            "expr": "gauge_active_games"
          }
        ]
      },
      {
        "title": "Leaderboard Updates/sec",
        "targets": [
          {
            "expr": "rate(leaderboard_updates_total[1m])"
          }
        ]
      },
      {
        "title": "AI Detection Accuracy",
        "targets": [
          {
            "expr": "rate(ai_detection_correct_total[5m]) / rate(ai_detection_total[5m])"
          }
        ]
      }
    ]
  }
}
```

### 4.3 Logging Architecture

```yaml
# fluentd-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fluentd-config
  namespace: logging
data:
  fluent.conf: |
    <source>
      @type tail
      path /var/log/containers/*.log
      pos_file /var/log/fluentd-containers.log.pos
      tag kubernetes.*
      read_from_head true
      <parse>
        @type json
        time_format %Y-%m-%dT%H:%M:%S.%NZ
      </parse>
    </source>
    
    <filter kubernetes.**>
      @type kubernetes_metadata
      @id filter_kube_metadata
    </filter>
    
    <filter kubernetes.var.log.containers.thinkrank-**.log>
      @type parser
      key_name log
      <parse>
        @type json
      </parse>
    </filter>
    
    <match kubernetes.var.log.containers.thinkrank-**.log>
      @type elasticsearch
      @id out_es
      @log_level info
      include_tag_key true
      host elasticsearch.logging.svc.cluster.local
      port 9200
      logstash_format true
      logstash_prefix thinkrank
      reconnect_on_error true
      reload_on_failure true
      reload_connections false
      request_timeout 120s
      <buffer>
        @type file
        path /var/log/fluentd-buffers/kubernetes.system.buffer
        flush_mode interval
        retry_type exponential_backoff
        flush_thread_count 2
        flush_interval 5s
        retry_forever
        retry_max_interval 30
        chunk_limit_size 2M
        queue_limit_length 8
        overflow_action block
      </buffer>
    </match>
```

This architecture design provides a comprehensive, scalable, and maintainable foundation for the ThinkRank platform, with detailed specifications for components, data management, infrastructure, and observability.