import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { json, urlencoded } from 'express';
import { config } from 'dotenv';
import { resolve } from 'path';

// Import our services and middleware
import { ComplianceEngine } from './services/compliance-engine.service';
import { errorHandler } from './middleware/error.middleware';
import { requestLogger } from './middleware/request.middleware';
import { validationMiddleware } from './middleware/validation.middleware';
import { complianceRoutes } from './routes/compliance.routes';
import { healthRoutes } from './routes/health.routes';

// Load environment variables
config();

/**
 * ThinkRank Compliance Service
 *
 * App Store compliance validation service that ensures mobile applications
 * meet iOS App Store and Google Play Store requirements before submission.
 *
 * Features:
 * - Multi-platform compliance validation (iOS + Android)
 * - Real-time compliance reporting
 * - Integration with build pipeline
 * - Automated fix recommendations
 * - Performance and security compliance checking
 */

class ComplianceService {
  private app: express.Application;
  private port: number;
  private complianceEngine: ComplianceEngine;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || '3000', 10);

    // Initialize compliance engine with configuration
    this.complianceEngine = new ComplianceEngine({
      enableCaching: process.env.ENABLE_CACHING === 'true',
      cacheTimeout: parseInt(process.env.CACHE_TIMEOUT || '3600000', 10), // 1 hour
      parallelValidation: process.env.PARALLEL_VALIDATION === 'true',
      maxConcurrency: parseInt(process.env.MAX_CONCURRENCY || '4', 10),
      enableMetrics: process.env.ENABLE_METRICS === 'true',
      config: {
        strictMode: process.env.STRICT_MODE === 'true',
        allowedPermissions: process.env.ALLOWED_PERMISSIONS?.split(',') || [],
        maxBundleSize: parseInt(process.env.MAX_BUNDLE_SIZE || '157286400', 10), // 150MB
        minDescriptionLength: parseInt(process.env.MIN_DESCRIPTION_LENGTH || '10', 10),
        maxDescriptionLength: parseInt(process.env.MAX_DESCRIPTION_LENGTH || '4000', 10),
        requiredMetadata: process.env.REQUIRED_METADATA?.split(',') || ['name', 'version', 'description']
      }
    });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Configure Express middleware
   */
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"]
        }
      },
      crossOriginEmbedderPolicy: false
    }));

    // CORS configuration
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
    }));

    // Compression middleware
    this.app.use(compression());

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
      message: {
        error: 'Too many requests',
        retryAfter: '15 minutes'
      },
      standardHeaders: true,
      legacyHeaders: false
    });
    this.app.use('/api/', limiter);

    // Body parsing middleware
    this.app.use(json({ limit: '10mb' }));
    this.app.use(urlencoded({ extended: true, limit: '10mb' }));

    // Request logging and tracing
    this.app.use(requestLogger);

    // Request validation
    this.app.use(validationMiddleware);
  }

  /**
   * Configure API routes
   */
  private setupRoutes(): void {
    // Health check routes
    this.app.use('/health', healthRoutes);

    // Main compliance validation routes
    this.app.use('/api/compliance', complianceRoutes);

    // API documentation (if enabled)
    if (process.env.ENABLE_API_DOCS === 'true') {
      // Could integrate with Swagger/OpenAPI here
    }

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.originalUrl} not found`,
        availableRoutes: [
          'GET /health',
          'POST /api/compliance/validate',
          'GET /api/compliance/report/:id',
          'GET /api/compliance/metrics'
        ]
      });
    });
  }

  /**
   * Configure error handling
   */
  private setupErrorHandling(): void {
    this.app.use(errorHandler);
  }

  /**
   * Start the compliance service
   */
  async start(): Promise<void> {
    try {
      // Perform startup health checks
      await this.performStartupChecks();

      // Start the server
      const server = this.app.listen(this.port, () => {
        console.log(`🚀 ThinkRank Compliance Service started successfully`);
        console.log(`📍 Server listening on port ${this.port}`);
        console.log(`🏥 Health check available at http://localhost:${this.port}/health`);
        console.log(`🔗 API endpoints available at http://localhost:${this.port}/api/compliance`);
        console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`⚡ Strict mode: ${process.env.STRICT_MODE === 'true' ? 'enabled' : 'disabled'}`);
      });

      // Graceful shutdown handling
      this.setupGracefulShutdown(server);

    } catch (error) {
      console.error('❌ Failed to start Compliance Service:', error);
      process.exit(1);
    }
  }

  /**
   * Perform startup validation and health checks
   */
  private async performStartupChecks(): Promise<void> {
    console.log('🔍 Performing startup checks...');

    // Check compliance engine health
    try {
      const health = await this.complianceEngine.healthCheck();
      console.log(`✅ Compliance engine health: ${health.status}`);
    } catch (error) {
      throw new Error(`Compliance engine health check failed: ${error.message}`);
    }

    // Validate required environment variables
    const requiredEnvVars = [
      'NODE_ENV',
      'ALLOWED_ORIGINS'
    ];

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        console.warn(`⚠️  Warning: ${envVar} environment variable not set`);
      }
    }

    console.log('✅ Startup checks completed');
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(server: any): void {
    const shutdown = async (signal: string) => {
      console.log(`📴 Received ${signal}, shutting down gracefully...`);

      server.close(async () => {
        console.log('🔌 HTTP server closed');

        try {
          // Perform cleanup operations
          await this.complianceEngine.clearCache();
          console.log('🧹 Cleanup completed');
        } catch (error) {
          console.error('❌ Error during cleanup:', error);
        }

        console.log('👋 Process terminated');
        process.exit(0);
      });

      // Force close server after 10 seconds
      setTimeout(() => {
        console.error('❌ Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    // Handle different termination signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2')); // nodemon restart
  }

  /**
   * Get the Express application instance
   */
  getApp(): express.Application {
    return this.app;
  }

  /**
   * Get the compliance engine instance
   */
  getComplianceEngine(): ComplianceEngine {
    return this.complianceEngine;
  }
}

// Create and start the service
const complianceService = new ComplianceService();

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Start the service
complianceService.start().catch((error) => {
  console.error('❌ Failed to start service:', error);
  process.exit(1);
});

export default complianceService;