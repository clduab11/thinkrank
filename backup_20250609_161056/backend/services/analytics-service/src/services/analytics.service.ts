import { createClient } from '@supabase/supabase-js';
import { logger } from './logger.service';

const supabaseUrl = process.env['SUPABASE_URL']!;
const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface AnalyticsEvent {
  id?: string;
  userId: string;
  eventType: string;
  eventData: any;
  timestamp: Date;
  sessionId?: string;
  userAgent?: string;
  ip?: string;
}

export interface UserSession {
  id?: string;
  userId: string;
  sessionStart: Date;
  sessionEnd?: Date;
  deviceInfo?: any;
  userAgent?: string;
  ip?: string;
}

export interface PerformanceMetric {
  userId: string;
  metricType: string;
  value: number;
  context?: any;
  timestamp: Date;
}

export interface ErrorEvent {
  userId?: string;
  errorType: string;
  errorMessage: string;
  stackTrace?: string;
  context?: any;
  timestamp: Date;
  userAgent?: string;
  ip?: string;
}

export interface BusinessEvent {
  userId: string;
  eventType: string;
  revenue?: number;
  currency?: string;
  metadata?: any;
  timestamp: Date;
}

export class AnalyticsService {
  async trackEvent(event: AnalyticsEvent): Promise<{ id: string }> {
    try {
      const { data, error } = await supabase
        .from('analytics_events')
        .insert({
          user_id: event.userId,
          event_type: event.eventType,
          event_data: event.eventData,
          timestamp: event.timestamp.toISOString(),
          session_id: event.sessionId,
          user_agent: event.userAgent,
          ip_address: event.ip
        })
        .select('id')
        .single();

      if (error) throw error;

      logger.info('Event tracked', {
        eventId: data.id,
        userId: event.userId,
        eventType: event.eventType
      });

      return { id: data.id };
    } catch (error) {
      logger.error('Failed to track event', { error, event });
      throw error;
    }
  }

  async startSession(session: UserSession): Promise<{ id: string }> {
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .insert({
          user_id: session.userId,
          session_start: session.sessionStart.toISOString(),
          device_info: session.deviceInfo,
          user_agent: session.userAgent,
          ip_address: session.ip
        })
        .select('id')
        .single();

      if (error) throw error;

      logger.info('Session started', {
        sessionId: data.id,
        userId: session.userId
      });

      return { id: data.id };
    } catch (error) {
      logger.error('Failed to start session', { error, session });
      throw error;
    }
  }

  async endSession(sessionId: string, endData: { sessionEnd: Date; finalEventData?: any }): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_sessions')
        .update({
          session_end: endData.sessionEnd.toISOString(),
          final_event_data: endData.finalEventData
        })
        .eq('id', sessionId);

      if (error) throw error;

      logger.info('Session ended', { sessionId });
    } catch (error) {
      logger.error('Failed to end session', { error, sessionId });
      throw error;
    }
  }

  async trackPerformance(metric: PerformanceMetric): Promise<void> {
    try {
      const { error } = await supabase
        .from('performance_metrics')
        .insert({
          user_id: metric.userId,
          metric_type: metric.metricType,
          value: metric.value,
          context: metric.context,
          timestamp: metric.timestamp.toISOString()
        });

      if (error) throw error;

      logger.info('Performance metric tracked', {
        userId: metric.userId,
        metricType: metric.metricType,
        value: metric.value
      });
    } catch (error) {
      logger.error('Failed to track performance metric', { error, metric });
      throw error;
    }
  }

  async trackError(errorEvent: ErrorEvent): Promise<void> {
    try {
      const { error } = await supabase
        .from('error_events')
        .insert({
          user_id: errorEvent.userId,
          error_type: errorEvent.errorType,
          error_message: errorEvent.errorMessage,
          stack_trace: errorEvent.stackTrace,
          context: errorEvent.context,
          timestamp: errorEvent.timestamp.toISOString(),
          user_agent: errorEvent.userAgent,
          ip_address: errorEvent.ip
        });

      if (error) throw error;

      logger.warn('Error event tracked', {
        userId: errorEvent.userId,
        errorType: errorEvent.errorType
      });
    } catch (error) {
      logger.error('Failed to track error event', { error, errorEvent });
      throw error;
    }
  }

  async trackBusinessEvent(businessEvent: BusinessEvent): Promise<void> {
    try {
      const { error } = await supabase
        .from('business_events')
        .insert({
          user_id: businessEvent.userId,
          event_type: businessEvent.eventType,
          revenue: businessEvent.revenue,
          currency: businessEvent.currency,
          metadata: businessEvent.metadata,
          timestamp: businessEvent.timestamp.toISOString()
        });

      if (error) throw error;

      logger.info('Business event tracked', {
        userId: businessEvent.userId,
        eventType: businessEvent.eventType,
        revenue: businessEvent.revenue
      });
    } catch (error) {
      logger.error('Failed to track business event', { error, businessEvent });
      throw error;
    }
  }

  async getUserSummary(userId: string, options?: { startDate?: Date; endDate?: Date }): Promise<any> {
    try {
      const startDate = options?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const endDate = options?.endDate || new Date();

      // Get event counts by type
      const { data: eventCounts, error: eventsError } = await supabase
        .from('analytics_events')
        .select('event_type')
        .eq('user_id', userId)
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString());

      if (eventsError) throw eventsError;

      // Get session data
      const { data: sessions, error: sessionsError } = await supabase
        .from('user_sessions')
        .select('session_start, session_end')
        .eq('user_id', userId)
        .gte('session_start', startDate.toISOString())
        .lte('session_start', endDate.toISOString());

      if (sessionsError) throw sessionsError;

      // Get performance metrics
      const { data: performance, error: performanceError } = await supabase
        .from('performance_metrics')
        .select('metric_type, value')
        .eq('user_id', userId)
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString());

      if (performanceError) throw performanceError;

      // Calculate summary statistics
      const eventTypeCounts = eventCounts?.reduce((acc: any, event) => {
        acc[event.event_type] = (acc[event.event_type] || 0) + 1;
        return acc;
      }, {}) || {};

      const totalSessions = sessions?.length || 0;
      const avgSessionDuration = sessions?.reduce((acc, session) => {
        if (session.session_end) {
          const duration = new Date(session.session_end).getTime() - new Date(session.session_start).getTime();
          return acc + duration;
        }
        return acc;
      }, 0) / Math.max(1, sessions?.filter(s => s.session_end).length || 1);

      const performanceByType = performance?.reduce((acc: any, metric) => {
        if (!acc[metric.metric_type]) {
          acc[metric.metric_type] = [];
        }
        acc[metric.metric_type].push(metric.value);
        return acc;
      }, {}) || {};

      return {
        userId,
        dateRange: { startDate, endDate },
        events: {
          total: eventCounts?.length || 0,
          byType: eventTypeCounts
        },
        sessions: {
          total: totalSessions,
          averageDuration: avgSessionDuration
        },
        performance: performanceByType
      };
    } catch (error) {
      logger.error('Failed to get user summary', { error, userId });
      throw error;
    }
  }
}
