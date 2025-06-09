# ThinkRank Architecture Documentation

## System Overview

ThinkRank is built on a microservices architecture designed for scalability, maintainability, and high performance. The system consists of multiple independent services communicating through well-defined APIs.

## Architecture Principles

1. **Microservices**: Each service handles a specific domain
2. **Event-Driven**: Services communicate through events for loose coupling
3. **API-First**: All services expose RESTful APIs
4. **Cloud-Native**: Designed for containerization and orchestration
5. **Security-First**: Authentication and authorization at every layer

## System Components

### Frontend Layer

```
┌─────────────────────────────────────────────────────────┐
│                    React Application                     │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Components  │  │ Redux Store  │  │  API Service  │  │
│  └─────────────┘  └──────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────┘
```

- **Technology**: React 18 with TypeScript
- **State Management**: Redux Toolkit
- **Styling**: Tailwind CSS
- **Build Tool**: Vite
- **Testing**: Vitest

### API Gateway

```
┌─────────────────────────────────────────────────────────┐
│                      Kong Gateway                        │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────┐   │
│  │  Routing │  │   Auth   │  │  Rate Limiting     │   │
│  └──────────┘  └──────────┘  └────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

- Routes requests to appropriate services
- Handles authentication and authorization
- Implements rate limiting and caching
- Provides API versioning

### Microservices

#### Auth Service (Port 3001)
```typescript
interface AuthService {
  register(userData: UserRegistration): Promise<User>
  login(credentials: LoginCredentials): Promise<AuthTokens>
  refresh(refreshToken: string): Promise<AuthTokens>
  logout(userId: string): Promise<void>
  verifyToken(token: string): Promise<TokenPayload>
}
```

**Responsibilities**:
- User registration and authentication
- JWT token generation and validation
- Password management
- Session management

**Database Schema**:
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### Game Service (Port 3002)
```typescript
interface GameService {
  startGame(userId: string, options: GameOptions): Promise<Game>
  submitAnswer(gameId: string, answer: Answer): Promise<AnswerResult>
  getGame(gameId: string): Promise<Game>
  endGame(gameId: string): Promise<GameResult>
  getLeaderboard(options: LeaderboardOptions): Promise<LeaderboardEntry[]>
}
```

**Responsibilities**:
- Game session management
- Challenge distribution
- Score calculation
- Leaderboard management

**Database Schema**:
```sql
CREATE TABLE games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    mode VARCHAR(50) NOT NULL,
    difficulty VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    score INTEGER DEFAULT 0,
    started_at TIMESTAMP DEFAULT NOW(),
    ended_at TIMESTAMP
);

CREATE TABLE game_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID REFERENCES games(id),
    challenge_id UUID NOT NULL,
    answer BOOLEAN NOT NULL,
    confidence INTEGER,
    time_spent INTEGER,
    is_correct BOOLEAN,
    points_earned INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### AI Service (Port 3003)
```typescript
interface AIService {
  generateContent(request: GenerateRequest): Promise<GeneratedContent>
  detectContent(content: Content): Promise<DetectionResult>
  getChallenge(difficulty: Difficulty): Promise<Challenge>
  validateChallenge(challenge: Challenge): Promise<ValidationResult>
}
```

**Responsibilities**:
- AI content generation
- Content detection algorithms
- Challenge creation and validation
- Model management

**Technologies**:
- OpenAI API integration
- Anthropic Claude API integration
- Custom detection models
- Redis caching for responses

#### Social Service (Port 3004)
```typescript
interface SocialService {
  createTeam(teamData: TeamData): Promise<Team>
  joinTeam(userId: string, teamId: string): Promise<void>
  sendFriendRequest(fromId: string, toId: string): Promise<FriendRequest>
  getTeamLeaderboard(teamId: string): Promise<TeamLeaderboard>
}
```

**Responsibilities**:
- Team management
- Friend system
- Social interactions
- Activity feeds

**Database Schema**:
```sql
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_by UUID REFERENCES users(id),
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE team_members (
    team_id UUID REFERENCES teams(id),
    user_id UUID REFERENCES users(id),
    role VARCHAR(20) DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (team_id, user_id)
);
```

### Data Layer

#### PostgreSQL
- Primary database for transactional data
- ACID compliance for critical operations
- Read replicas for scaling

#### Redis
- Session storage
- Caching layer
- Real-time leaderboards
- Pub/Sub for events

#### Supabase
- Real-time subscriptions
- Edge functions
- Vector embeddings for AI content

### Infrastructure Layer

#### Docker
```dockerfile
# Base configuration for Node.js services
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM base AS build
RUN npm ci
COPY . .
RUN npm run build

FROM base AS runtime
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

#### Kubernetes
- Container orchestration
- Auto-scaling based on load
- Rolling updates
- Service mesh for inter-service communication

#### Monitoring Stack
- **Prometheus**: Metrics collection
- **Grafana**: Visualization
- **ELK Stack**: Log aggregation
- **Jaeger**: Distributed tracing

## Data Flow

### Authentication Flow
```
User -> Frontend -> API Gateway -> Auth Service -> Database
                         |
                         v
                    JWT Token <- Auth Service
```

### Game Flow
```
User -> Start Game -> Game Service -> AI Service -> Challenge
  |                        |
  v                        v
Answer -> Game Service -> Score Calculation -> Leaderboard Update
               |
               v
         AI Service -> Detection Result
```

### Real-time Updates
```
Game Event -> Redis Pub/Sub -> WebSocket -> Frontend
                |
                v
          Supabase Realtime -> Subscribers
```

## Security Architecture

### Authentication & Authorization
- JWT tokens with short expiration
- Refresh token rotation
- Role-based access control (RBAC)
- API key management for service-to-service

### Data Protection
- TLS 1.3 for all communications
- Encryption at rest for sensitive data
- Database column encryption for PII
- Secrets management with Kubernetes secrets

### API Security
- Rate limiting per user/IP
- Input validation and sanitization
- SQL injection prevention
- XSS protection headers

## Performance Considerations

### Caching Strategy
1. **CDN**: Static assets and images
2. **Redis**: API responses, session data
3. **Browser**: Service worker caching
4. **Database**: Query result caching

### Optimization Techniques
- Database indexing on frequently queried fields
- Connection pooling for database connections
- Lazy loading for frontend components
- Image optimization and WebP format

### Scaling Strategy
- Horizontal scaling for stateless services
- Read replicas for database scaling
- Caching layer to reduce database load
- CDN for global content delivery

## Deployment Architecture

### Development Environment
- Docker Compose for local development
- Hot reloading for all services
- Shared volumes for code synchronization

### Staging Environment
- Kubernetes cluster on AWS EKS
- Automated deployments from develop branch
- Full monitoring stack
- Synthetic testing

### Production Environment
- Multi-region deployment
- Blue-green deployments
- Automated rollback on failures
- 99.9% uptime SLA

## Disaster Recovery

### Backup Strategy
- Daily automated database backups
- Point-in-time recovery capability
- Cross-region backup replication
- Regular backup restoration tests

### High Availability
- Multi-AZ deployments
- Load balancer health checks
- Automatic failover
- Circuit breaker pattern

## Future Considerations

### Planned Improvements
1. GraphQL API for complex queries
2. Machine learning pipeline for better detection
3. Blockchain integration for achievements
4. Native mobile applications

### Scalability Roadmap
1. Global CDN implementation
2. Multi-region active-active setup
3. Event sourcing for audit trail
4. CQRS for read/write separation