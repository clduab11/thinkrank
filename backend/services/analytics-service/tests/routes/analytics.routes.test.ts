import express from 'express';
import request from 'supertest';
import { analyticsRoutes } from '../../src/routes/analytics.routes';

// Mock the AnalyticsService
jest.mock('../../src/services/analytics.service', () => ({
  AnalyticsService: jest.fn().mockImplementation(() => ({
    trackEvent: jest.fn().mockResolvedValue({ id: 'test-event-id' }),
    startSession: jest.fn().mockResolvedValue({ id: 'test-session-id' }),
    endSession: jest.fn().mockResolvedValue(undefined),
    trackPerformance: jest.fn().mockResolvedValue(undefined),
    trackError: jest.fn().mockResolvedValue(undefined),
    trackBusinessEvent: jest.fn().mockResolvedValue(undefined),
    getUserSummary: jest.fn().mockResolvedValue({
      userId: 'test-user-id',
      events: { total: 10, byType: { 'game_start': 5 } },
      sessions: { total: 3, averageDuration: 300000 }
    })
  }))
}));

describe('Analytics Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/analytics', analyticsRoutes);
  });

  describe('POST /api/analytics/events', () => {
    it('should track an event successfully', async () => {
      const eventData = {
        userId: 'test-user-id',
        eventType: 'game_start',
        eventData: { level: 1 }
      };

      const response = await request(app)
        .post('/api/analytics/events')
        .send(eventData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.eventId).toBe('test-event-id');
    });

    it('should return 400 for invalid event data', async () => {
      const invalidData = {
        eventType: 'game_start'
        // Missing required userId
      };

      await request(app)
        .post('/api/analytics/events')
        .send(invalidData)
        .expect(400);
    });

    it('should handle service errors gracefully', async () => {
      // Mock service to throw error
      const { AnalyticsService } = require('../../src/services/analytics.service');
      const mockService = AnalyticsService.mock.results[0].value;
      mockService.trackEvent.mockRejectedValue(new Error('Database error'));

      const eventData = {
        userId: 'test-user-id',
        eventType: 'game_start',
        eventData: { level: 1 }
      };

      const response = await request(app)
        .post('/api/analytics/events')
        .send(eventData)
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/analytics/sessions', () => {
    it('should start a session successfully', async () => {
      const sessionData = {
        userId: 'test-user-id',
        deviceInfo: { platform: 'web' }
      };

      const response = await request(app)
        .post('/api/analytics/sessions')
        .send(sessionData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sessionId).toBe('test-session-id');
    });

    it('should handle missing optional fields', async () => {
      const sessionData = {
        userId: 'test-user-id'
      };

      const response = await request(app)
        .post('/api/analytics/sessions')
        .send(sessionData)
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });

  describe('PATCH /api/analytics/sessions/:sessionId/end', () => {
    it('should end a session successfully', async () => {
      const endData = {
        finalEventData: { exitReason: 'user_logout' }
      };

      const response = await request(app)
        .patch('/api/analytics/sessions/test-session-id/end')
        .send(endData)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle minimal end data', async () => {
      const response = await request(app)
        .patch('/api/analytics/sessions/test-session-id/end')
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/analytics/performance', () => {
    it('should track performance metrics successfully', async () => {
      const performanceData = {
        userId: 'test-user-id',
        metricType: 'fps',
        value: 60,
        context: { scene: 'main_menu' }
      };

      const response = await request(app)
        .post('/api/analytics/performance')
        .send(performanceData)
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should validate metric types', async () => {
      const invalidData = {
        userId: 'test-user-id',
        metricType: 'invalid_metric',
        value: 60
      };

      await request(app)
        .post('/api/analytics/performance')
        .send(invalidData)
        .expect(400);
    });
  });

  describe('POST /api/analytics/errors', () => {
    it('should track error events successfully', async () => {
      const errorData = {
        userId: 'test-user-id',
        errorType: 'network_error',
        errorMessage: 'Failed to connect',
        stackTrace: 'Error at line 1...'
      };

      const response = await request(app)
        .post('/api/analytics/errors')
        .send(errorData)
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should handle errors without user ID', async () => {
      const errorData = {
        errorType: 'javascript_error',
        errorMessage: 'Undefined variable'
      };

      const response = await request(app)
        .post('/api/analytics/errors')
        .send(errorData)
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/analytics/business', () => {
    it('should track business events successfully', async () => {
      const businessData = {
        userId: 'test-user-id',
        eventType: 'subscription_start',
        revenue: 9.99,
        currency: 'USD',
        metadata: { plan: 'premium' }
      };

      const response = await request(app)
        .post('/api/analytics/business')
        .send(businessData)
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should validate business event types', async () => {
      const invalidData = {
        userId: 'test-user-id',
        eventType: 'invalid_event',
        revenue: 9.99
      };

      await request(app)
        .post('/api/analytics/business')
        .send(invalidData)
        .expect(400);
    });
  });

  describe('GET /api/analytics/users/:userId/summary', () => {
    it('should get user summary successfully', async () => {
      const response = await request(app)
        .get('/api/analytics/users/test-user-id/summary')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('userId', 'test-user-id');
      expect(response.body.data).toHaveProperty('events');
      expect(response.body.data).toHaveProperty('sessions');
    });

    it('should accept date range query parameters', async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date().toISOString();

      const response = await request(app)
        .get('/api/analytics/users/test-user-id/summary')
        .query({ startDate, endDate })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle service errors gracefully', async () => {
      // Mock service to throw error
      const { AnalyticsService } = require('../../src/services/analytics.service');
      const mockService = AnalyticsService.mock.results[0].value;
      mockService.getUserSummary.mockRejectedValue(new Error('Database error'));

      await request(app)
        .get('/api/analytics/users/test-user-id/summary')
        .expect(500);
    });
  });
});
