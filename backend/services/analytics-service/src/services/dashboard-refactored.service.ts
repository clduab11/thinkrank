import { OverviewService, OverviewOptions } from './overview.service';
import { EngagementService, EngagementOptions } from './engagement.service';
import { logger } from './logger.service';
import { createClient } from '@supabase/supabase-js';
import moment from 'moment';

const supabaseUrl = process.env['SUPABASE_URL']!;
const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
  private overviewService = new OverviewService();
  private engagementService = new EngagementService();

  async getOverview(options: OverviewOptions): Promise<any> {
    return this.overviewService.getOverview(options);
  }

  async getEngagementMetrics(options: EngagementOptions): Promise<any> {
    return this.engagementService.getEngagementMetrics(options);
  }

  async getBusinessMetrics(options: BusinessMetricsOptions): Promise<any> {
    try {
      const { startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), endDate = new Date() } = options;
      
      logger.info('Fetching business metrics', { startDate, endDate });

      // Get revenue metrics
      const { data: subscriptions, error: subscriptionError } = await supabase
        .from('subscriptions')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (subscriptionError) {
        logger.error('Error fetching subscriptions', {}, subscriptionError);
        throw new Error('Failed to fetch subscription data');
      }

      const totalRevenue = subscriptions?.reduce((sum, sub) => sum + sub.amount, 0) || 0;
      const totalSubscriptions = subscriptions?.length || 0;
      const averageRevenuePerUser = totalSubscriptions > 0 ? totalRevenue / totalSubscriptions : 0;

      return {
        totalRevenue,
        totalSubscriptions,
        averageRevenuePerUser,
        period: { startDate, endDate }
      };
    } catch (error) {
      logger.error('Error in getBusinessMetrics', {}, error as Error);
      throw error;
    }
  }

  async getPerformanceMetrics(options: PerformanceOptions): Promise<any> {
    try {
      const { metricType = 'response_time', period } = options;
      
      logger.info('Fetching performance metrics', { metricType, period });

      const endDate = new Date();
      const startDate = this.calculateStartDate(period, endDate);

      // Get performance data based on metric type
      const { data: performanceData, error } = await supabase
        .from('performance_metrics')
        .select('*')
        .eq('metric_type', metricType)
        .gte('recorded_at', startDate.toISOString())
        .lte('recorded_at', endDate.toISOString());

      if (error) {
        logger.error('Error fetching performance metrics', {}, error);
        throw new Error('Failed to fetch performance data');
      }

      const averageValue = performanceData?.reduce((sum, metric) => sum + metric.value, 0) / (performanceData?.length || 1) || 0;

      return {
        metricType,
        averageValue,
        dataPoints: performanceData?.length || 0,
        period: { startDate, endDate }
      };
    } catch (error) {
      logger.error('Error in getPerformanceMetrics', {}, error as Error);
      throw error;
    }
  }

  async getErrorAnalytics(options: ErrorAnalyticsOptions): Promise<any> {
    try {
      const { period, groupBy } = options;
      
      logger.info('Fetching error analytics', { period, groupBy });

      const endDate = new Date();
      const startDate = this.calculateStartDate(period, endDate);

      const { data: errorData, error } = await supabase
        .from('error_logs')
        .select('*')
        .gte('occurred_at', startDate.toISOString())
        .lte('occurred_at', endDate.toISOString());

      if (error) {
        logger.error('Error fetching error data', {}, error);
        throw new Error('Failed to fetch error analytics');
      }

      const totalErrors = errorData?.length || 0;
      const errorsByType = this.groupErrors(errorData || [], groupBy);

      return {
        totalErrors,
        errorsByType,
        period: { startDate, endDate }
      };
    } catch (error) {
      logger.error('Error in getErrorAnalytics', {}, error as Error);
      throw error;
    }
  }

  async getRetentionMetrics(options: RetentionOptions): Promise<any> {
    try {
      const { cohortDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), period } = options;
      
      logger.info('Fetching retention metrics', { cohortDate, period });

      // Implementation would be more complex in real scenario
      // This is a simplified version
      return {
        cohortDate,
        period,
        retentionRate: 0.75, // Placeholder
        message: 'Retention metrics calculation simplified for code quality demonstration'
      };
    } catch (error) {
      logger.error('Error in getRetentionMetrics', {}, error as Error);
      throw error;
    }
  }

  async getRealTimeMetrics(): Promise<any> {
    try {
      logger.info('Fetching real-time metrics');

      const currentTime = new Date();
      const oneHourAgo = new Date(currentTime.getTime() - 60 * 60 * 1000);

      const { data: recentActivity, error } = await supabase
        .from('user_activity')
        .select('*')
        .gte('last_activity', oneHourAgo.toISOString())
        .lte('last_activity', currentTime.toISOString());

      if (error) {
        logger.error('Error fetching real-time data', {}, error);
        throw new Error('Failed to fetch real-time metrics');
      }

      return {
        activeUsers: recentActivity?.length || 0,
        timestamp: currentTime
      };
    } catch (error) {
      logger.error('Error in getRealTimeMetrics', {}, error as Error);
      throw error;
    }
  }

  async generateCustomReport(options: CustomReportOptions): Promise<any> {
    try {
      const { metrics, filters, groupBy, dateRange } = options;
      
      logger.info('Generating custom report', { metrics, filters, groupBy, dateRange });

      // Simplified custom report generation
      const results: Record<string, any> = {};

      for (const metric of metrics) {
        switch (metric) {
          case 'overview':
            results[metric] = await this.getOverview({ 
              startDate: dateRange.start, 
              endDate: dateRange.end 
            });
            break;
          case 'engagement':
            results[metric] = await this.getEngagementMetrics({ 
              period: '30d', 
              granularity: 'daily' 
            });
            break;
          case 'business':
            results[metric] = await this.getBusinessMetrics({ 
              startDate: dateRange.start, 
              endDate: dateRange.end 
            });
            break;
          default:
            logger.warn(`Unknown metric type: ${metric}`);
        }
      }

      return {
        metrics: results,
        filters,
        groupBy,
        dateRange,
        generatedAt: new Date()
      };
    } catch (error) {
      logger.error('Error in generateCustomReport', {}, error as Error);
      throw error;
    }
  }

  private calculateStartDate(period: string, endDate: Date): Date {
    const startDate = new Date(endDate);
    
    switch (period) {
      case '1h':
        startDate.setHours(endDate.getHours() - 1);
        break;
      case '24h':
        startDate.setDate(endDate.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }
    
    return startDate;
  }

  private groupErrors(errors: any[], groupBy: string): Record<string, number> {
    const grouped: Record<string, number> = {};
    
    for (const error of errors) {
      const key = error[groupBy] || 'unknown';
      grouped[key] = (grouped[key] || 0) + 1;
    }
    
    return grouped;
  }
}