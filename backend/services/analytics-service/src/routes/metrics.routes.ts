import { Request, Response, Router } from 'express';
import { logger } from '../services/logger.service';
import { MetricsCollector } from '../services/metrics.service';

const router = Router();
const metricsCollector = new MetricsCollector();

// Get system metrics
router.get('/system', async (req: Request, res: Response) => {
  try {
    const metrics = await metricsCollector.getSystemMetrics();

    res.status(200).json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error('Failed to get system metrics', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get system metrics'
    });
  }
});

// Get application metrics
router.get('/application', async (req: Request, res: Response) => {
  try {
    const metrics = await metricsCollector.getApplicationMetrics();

    res.status(200).json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error('Failed to get application metrics', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get application metrics'
    });
  }
});

// Get business metrics
router.get('/business', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    const metrics = await metricsCollector.getBusinessMetrics({
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined
    });

    res.status(200).json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error('Failed to get business metrics', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get business metrics'
    });
  }
});

// Get Prometheus metrics format
router.get('/prometheus', async (req: Request, res: Response) => {
  try {
    const metrics = await metricsCollector.getPrometheusMetrics();

    res.set('Content-Type', 'text/plain');
    res.status(200).send(metrics);
  } catch (error) {
    logger.error('Failed to get Prometheus metrics', { error });
    res.status(500).send('# Failed to get metrics\n');
  }
});

// Get health metrics for monitoring
router.get('/health', async (req: Request, res: Response) => {
  try {
    const healthMetrics = await metricsCollector.getHealthMetrics();

    res.status(200).json({
      success: true,
      data: healthMetrics
    });
  } catch (error) {
    logger.error('Failed to get health metrics', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get health metrics'
    });
  }
});

export { router as metricsRoutes };
