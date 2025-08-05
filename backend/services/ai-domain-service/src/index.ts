// AI Domain Service - Phase 2 Unified Implementation
// Entry point with proper DI container and lifecycle management

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { Pool } from 'pg';
import { config } from 'dotenv';

// Domain imports
import { UnifiedAIService } from './services/unified-ai.service';
import { ContentGenerationRepository } from './repositories/content-repository';
import { ResearchProblemRepository } from './repositories/research-problem-repository';
import { PostgreSQLEventStore } from './repositories/base-repository';
import { EventBusFactory } from './events/event-bus';
import { DatabaseManager, createDatabaseConfig } from './config/database';

// Infrastructure imports
import { createRoutes } from './routes';

// Load environment variables
config();

// Application configuration
const APP_CONFIG = {
  port: parseInt(process.env.PORT || '3002'),
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  serviceName: 'ai-domain-service',
  version: '2.0.0'
};

// Logger configuration
const logger = pino({
  name: APP_CONFIG.serviceName,
  level: APP_CONFIG.logLevel,
  formatters: {
    level: (label) => {
      return { level: label };
    }
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(APP_CONFIG.nodeEnv === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        ignore: 'pid,hostname',
        translateTime: 'SYS:standard'
      }
    }
  })
});

// Dependency Injection Container
class DIContainer {
  private instances = new Map<string, any>();

  register<T>(key: string, factory: () => T): void {
    this.instances.set(key, factory);
  }

  get<T>(key: string): T {
    const factory = this.instances.get(key);
    if (!factory) {
      throw new Error(`Service ${key} not registered`);
    }
    return factory();
  }

  async initialize(): Promise<void> {
    logger.info('Initializing dependency injection container');
    
    // Register logger
    this.register('logger', () => logger);

    // Register database manager
    this.register('databaseManager', () => {
      const dbConfig = createDatabaseConfig();
      return new DatabaseManager(dbConfig, logger);
    });

    // Register database pool
    this.register('databasePool', () => {
      return this.get<DatabaseManager>('databaseManager').getPrimaryPool();
    });

    // Register event store
    this.register('eventStore', () => {
      const pool = this.get<Pool>('databasePool');
      return new PostgreSQLEventStore(pool, logger);
    });

    // Register event bus
    this.register('eventBus', () => {
      const eventBusConfig = {
        type: process.env.EVENT_BUS_TYPE as 'memory' | 'rabbitmq' || 'memory',
        connectionUrl: process.env.RABBITMQ_URL
      };
      return EventBusFactory.create(logger, eventBusConfig);
    });

    // Register repositories
    this.register('contentRepository', () => {
      const pool = this.get<Pool>('databasePool');
      const eventStore = this.get('eventStore');
      return new ContentGenerationRepository(pool, eventStore, logger);
    });

    this.register('researchRepository', () => {
      const pool = this.get<Pool>('databasePool');
      const eventStore = this.get('eventStore');
      return new ResearchProblemRepository(pool, eventStore, logger);
    });

    // Register AI providers (mocked for development)
    this.register('openAIProvider', () => ({
      generateText: async (params: any) => {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
        return `Generated text about ${params.topic} with difficulty ${params.difficulty}`;
      },
      generateImage: async (params: any) => {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return `https://example.com/generated-image-${params.topic.replace(/\s+/g, '-')}.jpg`;
      },
      generateExplanation: async (params: any) => {
        return `This explains the challenge: ${JSON.stringify(params)}`;
      }
    }));

    this.register('anthropicProvider', () => ({
      generateText: async (params: any) => {
        await new Promise(resolve => setTimeout(resolve, 1200));
        return `Claude generated content about ${params.topic} (difficulty: ${params.difficulty})`;
      }
    }));

    this.register('detectionProvider', () => ({
      detectText: async (content: string) => {
        await new Promise(resolve => setTimeout(resolve, 500));
        const isAI = content.toLowerCase().includes('generated') || content.length > 100;
        return {
          isAIGenerated: isAI,
          confidence: isAI ? 0.85 : 0.15,
          explanation: isAI ? 'Contains patterns typical of AI generation' : 'Appears human-written'
        };
      },
      detectImage: async (content: string) => {
        await new Promise(resolve => setTimeout(resolve, 800));
        return {
          isAIGenerated: content.includes('generated'),
          confidence: 0.9,
          explanation: 'Image analysis result'
        };
      },
      analyzeComplexity: async (content: string) => {
        return Math.min(1.0, content.length / 500);
      }
    }));

    // Register main service
    this.register('unifiedAIService', () => {
      const contentRepo = this.get('contentRepository');
      const researchRepo = this.get('researchRepository');
      const eventBus = this.get('eventBus');
      const openAI = this.get('openAIProvider');
      const anthropic = this.get('anthropicProvider');
      const detection = this.get('detectionProvider');

      return new UnifiedAIService(
        contentRepo,
        researchRepo,
        eventBus,
        logger,
        openAI,
        anthropic,
        detection
      );
    });

    logger.info('Dependency injection container initialized');
  }

  async cleanup(): Promise<void> {
    logger.info('Cleaning up services');
    
    try {
      const databaseManager = this.get<DatabaseManager>('databaseManager');
      await databaseManager.close();
    } catch (error) {
      logger.error({ error }, 'Error during cleanup');
    }
  }
}

// Application class
class AIServerApplication {
  private app: express.Application;
  private container: DIContainer;
  private server?: any;

  constructor() {
    this.app = express();
    this.container = new DIContainer();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        }
      }
    }));

    // CORS
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Correlation-ID']
    }));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use(pinoHttp({
      logger,
      serializers: {
        req: (req) => ({
          method: req.method,
          url: req.url,
          headers: {
            'user-agent': req.headers['user-agent'],
            'content-type': req.headers['content-type'],
            'x-correlation-id': req.headers['x-correlation-id']
          }
        }),
        res: (res) => ({
          statusCode: res.statusCode,
          headers: {
            'content-type': res.getHeader('content-type')
          }
        })
      }
    }));

    // Health check
    this.app.get('/health', async (req, res) => {
      try {
        const unifiedService = this.container.get<UnifiedAIService>('unifiedAIService');
        const health = await unifiedService.healthCheck();
        
        res.status(health.status === 'healthy' ? 200 : 503).json({
          service: APP_CONFIG.serviceName,
          version: APP_CONFIG.version,
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          ...health
        });
      } catch (error) {
        logger.error({ error }, 'Health check failed');
        res.status(503).json({
          service: APP_CONFIG.serviceName,
          status: 'unhealthy',
          error: 'Health check failed'
        });
      }
    });

    // Ready check
    this.app.get('/ready', (req, res) => {
      res.json({
        service: APP_CONFIG.serviceName,
        version: APP_CONFIG.version,
        ready: true,
        timestamp: new Date().toISOString()
      });
    });
  }

  private setupRoutes(): void {
    const unifiedService = this.container.get<UnifiedAIService>('unifiedAIService');
    this.app.use('/api/v1', createRoutes(unifiedService, logger));
  }

  private setupErrorHandling(): void {
    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.originalUrl} not found`,
        timestamp: new Date().toISOString()
      });
    });

    // Global error handler
    this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      const correlationId = req.headers['x-correlation-id'] || 'unknown';
      
      logger.error({
        error: err,
        correlationId,
        method: req.method,
        url: req.url
      }, 'Unhandled error');

      res.status(err.status || 500).json({
        error: 'Internal Server Error',
        message: APP_CONFIG.nodeEnv === 'development' ? err.message : 'Something went wrong',
        correlationId,
        timestamp: new Date().toISOString()
      });
    });
  }

  async start(): Promise<void> {
    try {
      logger.info({ config: APP_CONFIG }, 'Starting AI Domain Service');

      // Initialize dependencies
      await this.container.initialize();

      // Setup Express application
      this.setupMiddleware();
      this.setupRoutes();
      this.setupErrorHandling();

      // Start server
      this.server = this.app.listen(APP_CONFIG.port, () => {
        logger.info({
          port: APP_CONFIG.port,
          nodeEnv: APP_CONFIG.nodeEnv,
          version: APP_CONFIG.version
        }, 'AI Domain Service started successfully');
      });

      // Setup graceful shutdown
      this.setupGracefulShutdown();

    } catch (error) {
      logger.error({ error }, 'Failed to start AI Domain Service');
      process.exit(1);
    }
  }

  private setupGracefulShutdown(): void {
    const gracefulShutdown = async (signal: string) => {
      logger.info({ signal }, 'Received shutdown signal');

      if (this.server) {
        this.server.close(async () => {
          logger.info('HTTP server closed');
          
          try {
            await this.container.cleanup();
            logger.info('Application cleanup completed');
            process.exit(0);
          } catch (error) {
            logger.error({ error }, 'Error during shutdown');
            process.exit(1);
          }
        });

        // Force close after 10 seconds
        setTimeout(() => {
          logger.error('Could not close connections in time, forcefully shutting down');
          process.exit(1);
        }, 10000);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // For nodemon

    process.on('uncaughtException', (error) => {
      logger.fatal({ error }, 'Uncaught exception');
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.fatal({ reason, promise }, 'Unhandled rejection');
      process.exit(1);
    });
  }
}

// Start the application
if (require.main === module) {
  const app = new AIServerApplication();
  app.start().catch((error) => {
    logger.fatal({ error }, 'Failed to start application');
    process.exit(1);
  });
}

export { AIServerApplication, DIContainer };