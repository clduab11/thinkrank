import { createClient } from '@supabase/supabase-js';
import moment from 'moment';
import { logger } from './logger.service';

const supabaseUrl = process.env['SUPABASE_URL']!;
const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface OverviewOptions {
  startDate?: Date;
  endDate?: Date;
}

export interface EngagementOptions {
  period: string;
  granularity: string;
}

export interface BusinessMetricsOptions {
  startDate?: Date;
  endDate?: Date;
}

export interface PerformanceOptions {
  metricType?: string;
  period: string;
}

export interface ErrorAnalyticsOptions {
  period: string;
  groupBy: string;
}

export interface RetentionOptions {
  cohortDate?: Date;
  period: string;
}

export interface CustomReportOptions {
  metrics: string[];
  filters: any;
  groupBy?: string;
  dateRange: {
    start: Date;
    end: Date;
  };
}

export class DashboardService {
  async getOverview(options: OverviewOptions): Promise<any> {
    try {
      const startDate = options.startDate || moment().subtract(30, 'days').toDate();
      const endDate = options.endDate || new Date();

      // Get total users
      const { count: totalUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      // Get active users in period
      const { count: activeUsers } = await supabase
        .from('analytics_events')
        .select('user_id', { count: 'exact', head: true })
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString());

      // Get total events
      const { count: totalEvents } = await supabase
        .from('analytics_events')
        .select('*', { count: 'exact', head: true })
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString());

      // Get total revenue
      const { data: revenueData } = await supabase
        .from('business_events')
        .select('revenue')
        .eq('event_type', 'subscription_start')
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString());

      const totalRevenue = revenueData?.reduce((sum, event) => sum + (event.revenue || 0), 0) || 0;

      // Get error count
      const { count: errorCount } = await supabase
        .from('error_events')
        .select('*', { count: 'exact', head: true })
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString());

      return {
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers || 0,
        totalEvents: totalEvents || 0,
        totalRevenue,
        errorCount: errorCount || 0,
        period: {
          start: startDate,
          end: endDate
        }
      };
    } catch (error) {
      logger.error('Failed to get overview', { error });
      throw error;
    }
  }

  async getEngagementMetrics(options: EngagementOptions): Promise<any> {
    try {
      const endDate = new Date();
      let startDate: Date;

      switch (options.period) {
        case 'last_24_hours':
          startDate = moment().subtract(24, 'hours').toDate();
          break;
        case 'last_7_days':
          startDate = moment().subtract(7, 'days').toDate();
          break;
        case 'last_30_days':
          startDate = moment().subtract(30, 'days').toDate();
          break;
        default:
          startDate = moment().subtract(7, 'days').toDate();
      }

      // Get daily active users
      const { data: dailyActiveUsers } = await supabase
        .from('analytics_events')
        .select('timestamp, user_id')
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString());

      // Get session data
      const { data: sessions } = await supabase
        .from('user_sessions')
        .select('session_start, session_end, user_id')
        .gte('session_start', startDate.toISOString())
        .lte('session_start', endDate.toISOString());

      // Calculate engagement metrics
      const dailyMetrics = this.calculateDailyEngagement(dailyActiveUsers || [], sessions || [], options.granularity);

      return {
        period: options.period,
        granularity: options.granularity,
        metrics: dailyMetrics
      };
    } catch (error) {
      logger.error('Failed to get engagement metrics', { error });
      throw error;
    }
  }

  async getBusinessMetrics(options: BusinessMetricsOptions): Promise<any> {
    try {
      const startDate = options.startDate || moment().subtract(30, 'days').toDate();
      const endDate = options.endDate || new Date();

      // Get subscription events
      const { data: subscriptions } = await supabase
        .from('business_events')
        .select('*')
        .in('event_type', ['subscription_start', 'subscription_cancel'])
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString());

      // Get purchase events
      const { data: purchases } = await supabase
        .from('business_events')
        .select('*')
        .eq('event_type', 'purchase')
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString());

      const totalRevenue = purchases?.reduce((sum, purchase) => sum + (purchase.revenue || 0), 0) || 0;
      const subscriptionStarts = subscriptions?.filter(s => s.event_type === 'subscription_start').length || 0;
      const subscriptionCancels = subscriptions?.filter(s => s.event_type === 'subscription_cancel').length || 0;

      return {
        totalRevenue,
        subscriptionStarts,
        subscriptionCancels,
        netSubscriptions: subscriptionStarts - subscriptionCancels,
        averageRevenuePerUser: totalRevenue / Math.max(1, subscriptionStarts),
        period: {
          start: startDate,
          end: endDate
        }
      };
    } catch (error) {
      logger.error('Failed to get business metrics', { error });
      throw error;
    }
  }

  async getPerformanceMetrics(options: PerformanceOptions): Promise<any> {
    try {
      const endDate = new Date();
      let startDate: Date;

      switch (options.period) {
        case 'last_hour':
          startDate = moment().subtract(1, 'hour').toDate();
          break;
        case 'last_24_hours':
          startDate = moment().subtract(24, 'hours').toDate();
          break;
        case 'last_7_days':
          startDate = moment().subtract(7, 'days').toDate();
          break;
        default:
          startDate = moment().subtract(24, 'hours').toDate();
      }

      let query = supabase
        .from('performance_metrics')
        .select('*')
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString());

      if (options.metricType) {
        query = query.eq('metric_type', options.metricType);
      }

      const { data: metrics } = await query;

      const performanceData = this.calculatePerformanceStats(metrics || []);

      return {
        period: options.period,
        metricType: options.metricType,
        ...performanceData
      };
    } catch (error) {
      logger.error('Failed to get performance metrics', { error });
      throw error;
    }
  }

  async getErrorAnalytics(options: ErrorAnalyticsOptions): Promise<any> {
    try {
      const endDate = new Date();
      let startDate: Date;

      switch (options.period) {
        case 'last_hour':
          startDate = moment().subtract(1, 'hour').toDate();
          break;
        case 'last_24_hours':
          startDate = moment().subtract(24, 'hours').toDate();
          break;
        case 'last_7_days':
          startDate = moment().subtract(7, 'days').toDate();
          break;
        default:
          startDate = moment().subtract(24, 'hours').toDate();
      }

      const { data: errors } = await supabase
        .from('error_events')
        .select('*')
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString());

      const groupedErrors = this.groupErrorsByType(errors || [], options.groupBy);

      return {
        period: options.period,
        groupBy: options.groupBy,
        totalErrors: errors?.length || 0,
        groupedData: groupedErrors
      };
    } catch (error) {
      logger.error('Failed to get error analytics', { error });
      throw error;
    }
  }

  async getRetentionMetrics(options: RetentionOptions): Promise<any> {
    try {
      const cohortDate = options.cohortDate || moment().subtract(30, 'days').toDate();

      // Get users who first used the app on the cohort date
      const { data: cohortUsers } = await supabase
        .from('analytics_events')
        .select('user_id, timestamp')
        .gte('timestamp', cohortDate.toISOString())
        .lt('timestamp', moment(cohortDate).add(1, 'day').toISOString())
        .order('timestamp', { ascending: true });

      // Calculate retention for each week/month after
      const retentionData = await this.calculateRetention(cohortUsers || [], cohortDate, options.period);

      return {
        cohortDate,
        period: options.period,
        cohortSize: cohortUsers?.length || 0,
        retentionData
      };
    } catch (error) {
      logger.error('Failed to get retention metrics', { error });
      throw error;
    }
  }

  async getRealTimeMetrics(): Promise<any> {
    try {
      const lastHour = moment().subtract(1, 'hour').toDate();
      const now = new Date();

      // Get current active users (users with events in last hour)
      const { data: activeUsers } = await supabase
        .from('analytics_events')
        .select('user_id')
        .gte('timestamp', lastHour.toISOString())
        .lte('timestamp', now.toISOString());

      const uniqueActiveUsers = new Set(activeUsers?.map(u => u.user_id)).size;

      // Get recent errors
      const { data: recentErrors } = await supabase
        .from('error_events')
        .select('*')
        .gte('timestamp', lastHour.toISOString())
        .lte('timestamp', now.toISOString())
        .order('timestamp', { ascending: false })
        .limit(10);

      // Get current performance metrics
      const { data: currentPerformance } = await supabase
        .from('performance_metrics')
        .select('*')
        .gte('timestamp', lastHour.toISOString())
        .lte('timestamp', now.toISOString());

      return {
        activeUsers: uniqueActiveUsers,
        recentErrors: recentErrors || [],
        currentPerformance: this.calculatePerformanceStats(currentPerformance || []),
        timestamp: now
      };
    } catch (error) {
      logger.error('Failed to get real-time metrics', { error });
      throw error;
    }
  }

  async generateCustomReport(options: CustomReportOptions): Promise<any> {
    try {
      // This is a simplified custom report generator
      // In a real implementation, you'd build dynamic queries based on the options

      const { data: events } = await supabase
        .from('analytics_events')
        .select('*')
        .gte('timestamp', options.dateRange.start.toISOString())
        .lte('timestamp', options.dateRange.end.toISOString());

      // Apply filters and grouping based on options
      const processedData = this.processCustomReportData(events || [], options);

      return {
        metrics: options.metrics,
        filters: options.filters,
        groupBy: options.groupBy,
        dateRange: options.dateRange,
        data: processedData
      };
    } catch (error) {
      logger.error('Failed to generate custom report', { error });
      throw error;
    }
  }

  private calculateDailyEngagement(events: any[], sessions: any[], granularity: string): any[] {
    // Group events by day/hour based on granularity
    const grouped = events.reduce((acc, event) => {
      const key = granularity === 'hourly'
        ? moment(event.timestamp).format('YYYY-MM-DD HH:00')
        : moment(event.timestamp).format('YYYY-MM-DD');

      if (!acc[key]) {
        acc[key] = new Set();
      }
      acc[key].add(event.user_id);
      return acc;
    }, {});

    return Object.entries(grouped).map(([date, users]: [string, any]) => ({
      date,
      activeUsers: users.size,
      events: events.filter(e => {
        const eventKey = granularity === 'hourly'
          ? moment(e.timestamp).format('YYYY-MM-DD HH:00')
          : moment(e.timestamp).format('YYYY-MM-DD');
        return eventKey === date;
      }).length
    }));
  }

  private calculatePerformanceStats(metrics: any[]): any {
    if (metrics.length === 0) {
      return { average: 0, min: 0, max: 0, count: 0 };
    }

    const values = metrics.map(m => m.value);
    return {
      average: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length,
      byType: metrics.reduce((acc, metric) => {
        if (!acc[metric.metric_type]) {
          acc[metric.metric_type] = [];
        }
        acc[metric.metric_type].push(metric.value);
        return acc;
      }, {})
    };
  }

  private groupErrorsByType(errors: any[], groupBy: string): any {
    return errors.reduce((acc, error) => {
      const key = error[groupBy] || 'unknown';
      if (!acc[key]) {
        acc[key] = 0;
      }
      acc[key]++;
      return acc;
    }, {});
  }

  private async calculateRetention(cohortUsers: any[], cohortDate: Date, period: string): Promise<any[]> {
    const retentionPeriods = [];

    for (let i = 1; i <= 12; i++) {
      const periodStart = period === 'weekly'
        ? moment(cohortDate).add(i, 'weeks').toDate()
        : moment(cohortDate).add(i, 'months').toDate();

      const periodEnd = period === 'weekly'
        ? moment(periodStart).add(1, 'week').toDate()
        : moment(periodStart).add(1, 'month').toDate();

      const { data: returnedUsers } = await supabase
        .from('analytics_events')
        .select('user_id')
        .in('user_id', cohortUsers.map(u => u.user_id))
        .gte('timestamp', periodStart.toISOString())
        .lt('timestamp', periodEnd.toISOString());

      const uniqueReturned = new Set(returnedUsers?.map(u => u.user_id)).size;
      const retentionRate = cohortUsers.length > 0 ? (uniqueReturned / cohortUsers.length) * 100 : 0;

      retentionPeriods.push({
        period: i,
        periodType: period,
        returnedUsers: uniqueReturned,
        retentionRate
      });
    }

    return retentionPeriods;
  }

  private processCustomReportData(events: any[], options: CustomReportOptions): any {
    // This is a simplified processor - in reality you'd implement
    // complex filtering, grouping, and aggregation logic
    let processedData = events;

    // Apply filters
    if (options.filters) {
      Object.entries(options.filters).forEach(([key, value]) => {
        processedData = processedData.filter(event =>
          event[key] === value || event.event_data?.[key] === value
        );
      });
    }

    // Group by specified field
    if (options.groupBy) {
      const grouped = processedData.reduce((acc, event) => {
        const groupKey = event[options.groupBy] || event.event_data?.[options.groupBy] || 'unknown';
        if (!acc[groupKey]) {
          acc[groupKey] = [];
        }
        acc[groupKey].push(event);
        return acc;
      }, {});

      return Object.entries(grouped).map(([key, events]: [string, any]) => ({
        group: key,
        count: events.length,
        events: events
      }));
    }

    return processedData;
  }
}
