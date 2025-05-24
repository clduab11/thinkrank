// Health check routes for the auth service
import { getDatabase } from '@thinkrank/shared';
import { Request, Response, Router } from 'express';

const router = Router();

// Basic health check
router.get('/', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      service: 'auth-service',
      checks: {
        database: 'healthy',
        memory: 'healthy',
        cpu: 'healthy'
      }
    };

    // Check database connectivity
    try {
      const db = getDatabase();
      const dbHealth = await db.healthCheck();
      healthStatus.checks.database = dbHealth.healthy ? 'healthy' : 'unhealthy';

      if (!dbHealth.healthy) {
        healthStatus.status = 'degraded';
      }
    } catch (error) {
      healthStatus.checks.database = 'unhealthy';
      healthStatus.status = 'degraded';
    }

    // Check memory usage
    const memoryUsage = process.memoryUsage();
    const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

    if (memoryUsagePercent > 90) {
      healthStatus.checks.memory = 'unhealthy';
      healthStatus.status = 'degraded';
    } else if (memoryUsagePercent > 75) {
      healthStatus.checks.memory = 'degraded';
      if (healthStatus.status === 'healthy') {
        healthStatus.status = 'degraded';
      }
    }

    const responseTime = Date.now() - startTime;

    // Return appropriate status code
    const statusCode = healthStatus.status === 'healthy' ? 200 :
                      healthStatus.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json({
      ...healthStatus,
      response_time_ms: responseTime
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;

    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      service: 'auth-service',
      checks: {
        database: 'unknown',
        memory: 'unknown',
        cpu: 'unknown'
      },
      response_time_ms: responseTime,
      error: 'Health check failed'
    });
  }
});

// Detailed health check with more metrics
router.get('/detailed', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      service: 'auth-service',
      system: {
        memory: {
          used: memoryUsage.heapUsed,
          total: memoryUsage.heapTotal,
          usage_percent: ((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100).toFixed(2),
          external: memoryUsage.external,
          rss: memoryUsage.rss
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        },
        node_version: process.version,
        platform: process.platform,
        arch: process.arch
      },
      checks: {
        database: 'checking',
        external_services: 'checking'
      }
    };

    // Database health check
    try {
      const db = getDatabase();
      const dbHealth = await db.healthCheck();
      healthStatus.checks.database = dbHealth.healthy ? 'healthy' : 'unhealthy';

      if (!dbHealth.healthy) {
        healthStatus.status = 'degraded';
      }
    } catch (error) {
      healthStatus.checks.database = 'unhealthy';
      healthStatus.status = 'unhealthy';
    }

    // Check if we can reach external services (mock for now)
    healthStatus.checks.external_services = 'healthy';

    const responseTime = Date.now() - startTime;

    const statusCode = healthStatus.status === 'healthy' ? 200 :
                      healthStatus.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json({
      ...healthStatus,
      response_time_ms: responseTime
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;

    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Detailed health check failed',
      response_time_ms: responseTime
    });
  }
});

// Liveness probe (for Kubernetes)
router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    service: 'auth-service'
  });
});

// Readiness probe (for Kubernetes)
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check critical dependencies
    const db = getDatabase();
    const dbHealth = await db.healthCheck();

    if (dbHealth.healthy) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        service: 'auth-service'
      });
    } else {
      res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        service: 'auth-service',
        reason: 'Database not available'
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      service: 'auth-service',
      reason: 'Health check failed'
    });
  }
});

export { router as healthRoutes };
