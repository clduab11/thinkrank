import { Request, Response, Router } from 'express';
import { DashboardService } from '../services/dashboard.service';
import { logger } from '../services/logger.service';

const router = Router();
const dashboardService = new DashboardService();

// Get overview dashboard data
router.get('/overview', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    const overview = await dashboardService.getOverview({
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined
    });

    res.status(200).json({
      success: true,
      data: overview
    });
  } catch (error) {
    logger.error('Failed to get dashboard overview', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard overview'
    });
  }
});

// Get user engagement metrics
router.get('/engagement', async (req: Request, res: Response) => {
  try {
    const { period, granularity } = req.query;

    const engagement = await dashboardService.getEngagementMetrics({
      period: period as string || 'last_7_days',
      granularity: granularity as string || 'daily'
    });

    res.status(200).json({
      success: true,
      data: engagement
    });
  } catch (error) {
    logger.error('Failed to get engagement metrics', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get engagement metrics'
    });
  }
});

// Get business metrics (revenue, subscriptions, etc.)
router.get('/business', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    const business = await dashboardService.getBusinessMetrics({
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined
    });

    res.status(200).json({
      success: true,
      data: business
    });
  } catch (error) {
    logger.error('Failed to get business metrics', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get business metrics'
    });
  }
});

// Get performance metrics
router.get('/performance', async (req: Request, res: Response) => {
  try {
    const { metricType, period } = req.query;

    const performance = await dashboardService.getPerformanceMetrics({
      metricType: metricType as string,
      period: period as string || 'last_24_hours'
    });

    res.status(200).json({
      success: true,
      data: performance
    });
  } catch (error) {
    logger.error('Failed to get performance metrics', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get performance metrics'
    });
  }
});

// Get error analytics
router.get('/errors', async (req: Request, res: Response) => {
  try {
    const { period, groupBy } = req.query;

    const errors = await dashboardService.getErrorAnalytics({
      period: period as string || 'last_24_hours',
      groupBy: groupBy as string || 'error_type'
    });

    res.status(200).json({
      success: true,
      data: errors
    });
  } catch (error) {
    logger.error('Failed to get error analytics', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get error analytics'
    });
  }
});

// Get user retention metrics
router.get('/retention', async (req: Request, res: Response) => {
  try {
    const { cohortDate, period } = req.query;

    const retention = await dashboardService.getRetentionMetrics({
      cohortDate: cohortDate ? new Date(cohortDate as string) : undefined,
      period: period as string || 'weekly'
    });

    res.status(200).json({
      success: true,
      data: retention
    });
  } catch (error) {
    logger.error('Failed to get retention metrics', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get retention metrics'
    });
  }
});

// Get real-time metrics
router.get('/realtime', async (req: Request, res: Response) => {
  try {
    const realtime = await dashboardService.getRealTimeMetrics();

    res.status(200).json({
      success: true,
      data: realtime
    });
  } catch (error) {
    logger.error('Failed to get real-time metrics', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get real-time metrics'
    });
  }
});

// Get custom report
router.post('/reports/custom', async (req: Request, res: Response) => {
  try {
    const { metrics, filters, groupBy, dateRange } = req.body;

    const report = await dashboardService.generateCustomReport({
      metrics,
      filters,
      groupBy,
      dateRange
    });

    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    logger.error('Failed to generate custom report', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to generate custom report'
    });
  }
});

export { router as dashboardRoutes };
