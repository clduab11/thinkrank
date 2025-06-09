import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Social service is healthy',
    timestamp: new Date().toISOString(),
    service: 'social-service',
    version: '1.0.0'
  });
});

router.get('/ready', (req, res) => {
  // Add any readiness checks here (database connectivity, external services, etc.)
  res.json({
    success: true,
    message: 'Social service is ready',
    timestamp: new Date().toISOString()
  });
});

export { router as healthRoutes };
