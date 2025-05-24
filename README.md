# ThinkRank - AI Research Gaming Platform

[![CI/CD Pipeline](https://github.com/thinkrank/thinkrank/workflows/CI/CD%20Pipeline/badge.svg)](https://github.com/thinkrank/thinkrank/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Unity Version](https://img.shields.io/badge/Unity-2023.3.0f1-blue.svg)](https://unity3d.com/get-unity/download)
[![Node.js Version](https://img.shields.io/badge/Node.js-20.10.0-green.svg)](https://nodejs.org/)

ThinkRank is a revolutionary hybrid gaming-educational mobile platform that combines engaging game mechanics with generative AI education and research contribution. Players engage in bias detection challenges while contributing to real AI research through crowdsourced problem-solving.

## 🎯 Project Overview

- **Platform**: Cross-platform mobile (iOS/Android)
- **Technology Stack**: Unity 2023.3 LTS, Node.js/TypeScript, Supabase, AWS
- **Architecture**: Microservices backend with cloud-native deployment
- **Performance Targets**: 60fps gameplay, <200ms API responses

## 🏗️ Architecture

```
ThinkRank/
├── client/                 # Unity mobile client
│   ├── unity-project/     # Unity 2023.3 LTS project
│   ├── mobile-builds/     # Platform-specific builds
│   └── build-scripts/     # Automated build scripts
├── backend/               # Backend microservices
│   ├── services/          # Individual microservices
│   ├── shared/           # Shared libraries and types
│   └── tests/            # Integration and performance tests
├── infrastructure/        # Infrastructure as Code
│   ├── terraform/        # AWS infrastructure
│   ├── docker/          # Container configurations
│   └── kubernetes/      # K8s deployments
├── deployment/           # CI/CD and monitoring
│   ├── ci-cd/           # GitHub Actions workflows
│   └── monitoring/      # Observability stack
└── documentation/        # Project documentation
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20.10.0+
- **Unity** 2023.3.0f1
- **Docker** 24.0.7+
- **AWS CLI** 2.13.0+
- **kubectl** 1.28+
- **Terraform** 1.6.0+

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/thinkrank/thinkrank.git
   cd thinkrank
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration values
   ```

4. **Start development environment**
   ```bash
   # Start backend services
   npm run dev

   # In another terminal, start infrastructure
   docker-compose -f infrastructure/docker/docker-compose.yml up -d
   ```

5. **Open Unity project**
   - Open Unity Hub
   - Add project: `client/unity-project`
   - Open with Unity 2023.3.0f1

### Building for Production

#### Backend Services
```bash
npm run build
npm run docker:build
```

#### Mobile Clients
```bash
# iOS
npm run unity:build:ios

# Android
npm run unity:build:android
```

## 🛠️ Development Workflow

### Backend Development
- **Languages**: TypeScript, Node.js
- **Framework**: Express.js with microservices architecture
- **Database**: PostgreSQL (transactional), Supabase (research data)
- **Caching**: Redis
- **API Design**: RESTful with GraphQL for complex queries

### Unity Client Development
- **Version**: Unity 2023.3 LTS
- **UI Framework**: UI Toolkit
- **Networking**: Unity Netcode for GameObjects
- **Performance**: Built-in profiling and 60fps optimization
- **Platforms**: iOS 13+, Android API 23+

### Code Standards
- **ESLint + Prettier** for TypeScript/JavaScript
- **Unity Code Analysis** for C#
- **Conventional Commits** for git messages
- **Branch Strategy**: GitFlow (main/develop/feature)

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific service tests
npm test --workspace=backend/services/auth-service

# Run integration tests
npm run test:integration

# Run performance tests
npm run test:performance
```

## 🚀 Deployment

### Development Environment
```bash
# Deploy to development
kubectl apply -k infrastructure/kubernetes/overlays/dev
```

### Production Environment
```bash
# Deploy infrastructure
cd infrastructure/terraform
terraform init
terraform plan
terraform apply

# Deploy applications
kubectl apply -k infrastructure/kubernetes/overlays/production
```

## 📊 Monitoring & Observability

- **Metrics**: Prometheus + Grafana
- **Logging**: ELK Stack (Elasticsearch, Logstash, Kibana)
- **Tracing**: Jaeger for distributed tracing
- **Alerts**: AlertManager with Slack integration
- **Unity Analytics**: Built-in Unity Analytics + Supabase

## 🏗️ Services Architecture

### Backend Microservices

| Service | Port | Purpose |
|---------|------|---------|
| API Gateway | 3000 | Request routing and rate limiting |
| Auth Service | 3001 | Authentication and authorization |
| Game Service | 3002 | Game logic and progression |
| AI Research Service | 3003 | Research problem distribution |
| Social Service | 3004 | Social media integration |
| Analytics Service | 3005 | Metrics and analytics |

### Infrastructure Components

- **AWS EKS**: Kubernetes orchestration
- **Amazon RDS**: PostgreSQL database
- **Amazon ElastiCache**: Redis caching
- **Amazon S3 + CloudFront**: Asset storage and CDN
- **Supabase**: Real-time backend services

## 🔒 Security

- **Authentication**: JWT with refresh tokens
- **Authorization**: Role-based access control (RBAC)
- **Data Encryption**: TLS 1.3 in transit, AES-256 at rest
- **Compliance**: GDPR and CCPA compliant
- **Security Scanning**: Snyk integration in CI/CD
- **Secrets Management**: AWS Secrets Manager

## 📈 Performance Targets

### Mobile Client
- **Frame Rate**: 60fps (95th percentile)
- **Memory Usage**: <500MB on target devices
- **Load Times**: <3s app startup, <1s scene transitions
- **Battery Efficiency**: <10% drain per hour

### Backend Services
- **Response Time**: <200ms (99th percentile)
- **Throughput**: 10,000 requests/second per service
- **Availability**: 99.9% uptime
- **Scalability**: Auto-scaling 2-100 pods per service

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow the established coding standards
- Write comprehensive tests
- Update documentation for new features
- Ensure CI/CD pipeline passes
- Request review from core team members

## 📝 Documentation

- [Architecture Guide](documentation/architecture/)
- [API Documentation](documentation/api-specs/)
- [Development Guide](documentation/development-guides/)
- [Deployment Guide](documentation/deployment-guides/)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

- **Documentation**: [docs.thinkrank.com](https://docs.thinkrank.com)
- **Issues**: [GitHub Issues](https://github.com/thinkrank/thinkrank/issues)
- **Discussions**: [GitHub Discussions](https://github.com/thinkrank/thinkrank/discussions)
- **Email**: support@thinkrank.com

## 🎯 Roadmap

### Phase 1: Foundation (Current)
- ✅ Project structure and development environment
- 🔄 Core authentication and game systems
- 🔄 Basic AI research integration

### Phase 2: Core Features
- 📝 Bias detection game mechanics
- 📝 Research problem distribution
- 📝 Player progression system

### Phase 3: Social Features
- 📝 Social media integration
- 📝 Leaderboards and achievements
- 📝 Community features

### Phase 4: Launch Preparation
- 📝 Beta testing and optimization
- 📝 App store submission
- 📝 Production deployment

---

**Built with ❤️ by the ThinkRank Team**
