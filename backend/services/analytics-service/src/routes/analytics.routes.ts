import { Request, Response, Router } from 'express';
import { validateAnalyticsEvent } from '../middleware/validation.middleware';
import { AnalyticsService } from '../services/analytics.service';
import { logger } from '../services/logger.service';

const router = Router();
const analyticsService = new AnalyticsService();

// Track user events
router.post('/events', validateAnalyticsEvent, async (req: Request, res: Response) => {
  try {
    const { userId, eventType, eventData, timestamp } = req.body;

    const event = await analyticsService.trackEvent({
      userId,
      eventType,
      eventData,
      timestamp: timestamp || new Date(),
      sessionId: req.headers['x-session-id'] as string,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    res.status(201).json({
      success: true,
      data: { eventId: event.id },
      message: 'Event tracked successfully'
    });
  } catch (error) {
    logger.error('Failed to track event', { error, body: req.body });
    res.status(500).json({
      success: false,
      error: 'Failed to track event'
    });
  }
});

// Track user sessions
router.post('/sessions', async (req: Request, res: Response) => {
  try {
    const { userId, sessionStart, deviceInfo } = req.body;

    const session = await analyticsService.startSession({
      userId,
      sessionStart: sessionStart || new Date(),
      deviceInfo,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    res.status(201).json({
      success: true,
      data: { sessionId: session.id },
      message: 'Session started successfully'
    });
  } catch (error) {
    logger.error('Failed to start session', { error, body: req.body });
    res.status(500).json({
      success: false,
      error: 'Failed to start session'
    });
  }
});

// End user session
router.patch('/sessions/:sessionId/end', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { sessionEnd, finalEventData } = req.body;

    await analyticsService.endSession(sessionId, {
      sessionEnd: sessionEnd || new Date(),
      finalEventData
    });

    res.status(200).json({
      success: true,
      message: 'Session ended successfully'
    });
  } catch (error) {
    logger.error('Failed to end session', { error, sessionId: req.params.sessionId });
    res.status(500).json({
      success: false,
      error: 'Failed to end session'
    });
  }
});

// Track performance metrics
router.post('/performance', async (req: Request, res: Response) => {
  try {
    const { userId, metricType, value, context } = req.body;

    await analyticsService.trackPerformance({
      userId,
      metricType,
      value,
      context,
      timestamp: new Date()
    });

    res.status(201).json({
      success: true,
      message: 'Performance metric tracked successfully'
    });
  } catch (error) {
    logger.error('Failed to track performance metric', { error, body: req.body });
    res.status(500).json({
      success: false,
      error: 'Failed to track performance metric'
    });
  }
});

// Track errors and crashes
router.post('/errors', async (req: Request, res: Response) => {
  try {
    const { userId, errorType, errorMessage, stackTrace, context } = req.body;

    await analyticsService.trackError({
      userId,
      errorType,
      errorMessage,
      stackTrace,
      context,
      timestamp: new Date(),
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    res.status(201).json({
      success: true,
      message: 'Error tracked successfully'
    });
  } catch (error) {
    logger.error('Failed to track error', { error, body: req.body });
    res.status(500).json({
      success: false,
      error: 'Failed to track error'
    });
  }
});

// Track business events (subscriptions, payments, etc.)
router.post('/business', async (req: Request, res: Response) => {
  try {
    const { userId, eventType, revenue, currency, metadata } = req.body;

    await analyticsService.trackBusinessEvent({
      userId,
      eventType,
      revenue,
      currency: currency || 'USD',
      metadata,
      timestamp: new Date()
    });

    res.status(201).json({
      success: true,
      message: 'Business event tracked successfully'
    });
  } catch (error) {
    logger.error('Failed to track business event', { error, body: req.body });
    res.status(500).json({
      success: false,
      error: 'Failed to track business event'
    });
  }
});

// Get user analytics summary
router.get('/users/:userId/summary', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;

    const summary = await analyticsService.getUserSummary(userId, {
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined
    });

    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    logger.error('Failed to get user summary', { error, userId: req.params.userId });
    res.status(500).json({
      success: false,
      error: 'Failed to get user summary'
    });
  }
});

export { router as analyticsRoutes };
