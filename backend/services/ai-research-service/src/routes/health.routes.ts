import { Request, Response, Router } from 'express';

const router = Router();

/**
 * Health check endpoint
 */
router.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'healthy',
      service: 'ai-research-service',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development'
    },
    meta: {
      timestamp: new Date().toISOString(),
      request_id: req.requestId,
      version: '1.0.0'
    }
  });
});

/**
 * Detailed health check with dependencies
 */
router.get('/detailed', async (req: Request, res: Response) => {
  const healthData = {
    status: 'healthy',
    service: 'ai-research-service',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development',
    dependencies: {
      database: 'unknown',
      supabase: 'unknown'
    }
  };

  try {
    // Test database connection
    // TODO: Add actual database health check
    healthData.dependencies.database = 'healthy';

    // Test Supabase connection
    // TODO: Add actual Supabase health check
    healthData.dependencies.supabase = 'healthy';

    res.status(200).json({
      success: true,
      data: healthData,
      meta: {
        timestamp: new Date().toISOString(),
        request_id: req.requestId,
        version: '1.0.0'
      }
    });
  } catch (error) {
    healthData.status = 'unhealthy';

    res.status(503).json({
      success: false,
      data: healthData,
      error: {
        code: 'HEALTH_CHECK_FAILED',
        message: 'Service health check failed'
      },
      meta: {
        timestamp: new Date().toISOString(),
        request_id: req.requestId,
        version: '1.0.0'
      }
    });
  }
});

export default router;
