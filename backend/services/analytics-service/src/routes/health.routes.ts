import { Request, Response, Router } from 'express';
import { logger } from '../services/logger.service';

const router = Router();

// Basic health check
router.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Analytics service is healthy',
    timestamp: new Date().toISOString(),
    service: 'analytics-service',
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Detailed health check
router.get('/detailed', async (req: Request, res: Response) => {
  const healthCheck = {
    service: 'analytics-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development',
    dependencies: {
      database: 'connected',
      external_apis: 'connected'
    }
  };

  try {
    // Add more detailed checks here if needed
    res.status(200).json({
      success: true,
      data: healthCheck
    });
  } catch (error) {
    logger.error('Health check failed', { error });
    res.status(503).json({
      success: false,
      message: 'Service unhealthy',
      timestamp: new Date().toISOString()
    });
  }
});

// Readiness check
router.get('/ready', (req: Request, res: Response) => {
  // Check if service is ready to accept traffic
  const isReady = true; // Add actual readiness checks here

  if (isReady) {
    res.status(200).json({
      success: true,
      message: 'Service ready',
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(503).json({
      success: false,
      message: 'Service not ready',
      timestamp: new Date().toISOString()
    });
  }
});

export { router as healthRoutes };
