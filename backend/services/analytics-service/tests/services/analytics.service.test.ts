import { AnalyticsService } from '../../src/services/analytics.service';
import { createClient } from '@supabase/supabase-js';
import { createTestEvent } from '../setup';

// Mock the createClient function
jest.mock('@supabase/supabase-js');
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

describe('AnalyticsService', () => {
  let analyticsService: AnalyticsService;

  beforeEach(() => {
    analyticsService = new AnalyticsService();
  });

  describe('trackEvent', () => {
    it('should track an event successfully', async () => {
      const testEvent = createTestEvent();

      const result = await analyticsService.trackEvent(testEvent);

      expect(result).toHaveProperty('id');
      expect(result.id).toBe('test-id');
    });

    it('should handle missing optional fields', async () => {
      const testEvent = createTestEvent({
        sessionId: undefined,
        userAgent: undefined,
        ip: undefined
      });

      const result = await analyticsService.trackEvent(testEvent);

      expect(result).toHaveProperty('id');
    });

    it('should throw error when database fails', async () => {
      // Mock database failure
      const mockSupabase = mockCreateClient();
      mockSupabase.from().insert().select().single.mockResolvedValue({
        data: null,
        error: new Error('Database error')
      });

      const testEvent = createTestEvent();

      await expect(analyticsService.trackEvent(testEvent)).rejects.toThrow();
    });
  });

  describe('startSession', () => {
    it('should start a session successfully', async () => {
      const sessionData = {
        userId: 'test-user-id',
        sessionStart: new Date(),
        deviceInfo: { platform: 'web' }
      };

      const result = await analyticsService.startSession(sessionData);

      expect(result).toHaveProperty('id');
      expect(result.id).toBe('test-id');
    });

    it('should handle session with minimal data', async () => {
      const sessionData = {
        userId: 'test-user-id',
        sessionStart: new Date()
      };

      const result = await analyticsService.startSession(sessionData);

      expect(result).toHaveProperty('id');
    });
  });

  describe('endSession', () => {
    it('should end a session successfully', async () => {
      const sessionId = 'test-session-id';
      const endData = {
        sessionEnd: new Date(),
        finalEventData: { exitReason: 'user_logout' }
      };

      await expect(analyticsService.endSession(sessionId, endData)).resolves.not.toThrow();
    });

    it('should handle session end with minimal data', async () => {
      const sessionId = 'test-session-id';
      const endData = {
        sessionEnd: new Date()
      };

      await expect(analyticsService.endSession(sessionId, endData)).resolves.not.toThrow();
    });
  });

  describe('trackPerformance', () => {
    it('should track performance metrics successfully', async () => {
      const performanceMetric = {
        userId: 'test-user-id',
        metricType: 'fps',
        value: 60,
        context: { scene: 'main_menu' },
        timestamp: new Date()
      };

      await expect(analyticsService.trackPerformance(performanceMetric)).resolves.not.toThrow();
    });

    it('should validate performance metric types', async () => {
      const performanceMetric = {
        userId: 'test-user-id',
        metricType: 'response_time',
        value: 150,
        timestamp: new Date()
      };

      await expect(analyticsService.trackPerformance(performanceMetric)).resolves.not.toThrow();
    });
  });

  describe('trackError', () => {
    it('should track error events successfully', async () => {
      const errorEvent = {
        userId: 'test-user-id',
        errorType: 'network_error',
        errorMessage: 'Failed to connect to server',
        stackTrace: 'Error at line 1...',
        context: { endpoint: '/api/users' },
        timestamp: new Date()
      };

      await expect(analyticsService.trackError(errorEvent)).resolves.not.toThrow();
    });

    it('should handle errors without user ID', async () => {
      const errorEvent = {
        errorType: 'javascript_error',
        errorMessage: 'Undefined variable',
        timestamp: new Date()
      };

      await expect(analyticsService.trackError(errorEvent)).resolves.not.toThrow();
    });
  });

  describe('trackBusinessEvent', () => {
    it('should track subscription events successfully', async () => {
      const businessEvent = {
        userId: 'test-user-id',
        eventType: 'subscription_start',
        revenue: 9.99,
        currency: 'USD',
        metadata: { plan: 'premium' },
        timestamp: new Date()
      };

      await expect(analyticsService.trackBusinessEvent(businessEvent)).resolves.not.toThrow();
    });

    it('should handle free events without revenue', async () => {
      const businessEvent = {
        userId: 'test-user-id',
        eventType: 'subscription_cancel',
        timestamp: new Date()
      };

      await expect(analyticsService.trackBusinessEvent(businessEvent)).resolves.not.toThrow();
    });
  });

  describe('getUserSummary', () => {
    it('should generate user summary successfully', async () => {
      const userId = 'test-user-id';
      const options = {
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date()
      };

      const summary = await analyticsService.getUserSummary(userId, options);

      expect(summary).toHaveProperty('userId', userId);
      expect(summary).toHaveProperty('events');
      expect(summary).toHaveProperty('sessions');
      expect(summary).toHaveProperty('performance');
      expect(summary.events).toHaveProperty('total');
      expect(summary.events).toHaveProperty('byType');
    });

    it('should use default date range when no options provided', async () => {
      const userId = 'test-user-id';

      const summary = await analyticsService.getUserSummary(userId);

      expect(summary).toHaveProperty('userId', userId);
      expect(summary).toHaveProperty('dateRange');
      expect(summary.dateRange.startDate).toBeInstanceOf(Date);
      expect(summary.dateRange.endDate).toBeInstanceOf(Date);
    });

    it('should handle empty data gracefully', async () => {
      // Mock empty responses
      const mockSupabase = mockCreateClient();
      mockSupabase.from().select().eq().gte().lte.mockResolvedValue({
        data: [],
        error: null
      });

      const userId = 'test-user-id';
      const summary = await analyticsService.getUserSummary(userId);

      expect(summary.events.total).toBe(0);
      expect(summary.sessions.total).toBe(0);
    });
  });
});
