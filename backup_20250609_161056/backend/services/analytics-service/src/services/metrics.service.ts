import { createClient } from '@supabase/supabase-js';
import * as cron from 'node-cron';
import * as os from 'os';
import { logger } from './logger.service';

const supabaseUrl = process.env['SUPABASE_URL']!;
const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface BusinessMetricsOptions {
  startDate?: Date;
  endDate?: Date;
}

export class MetricsCollector {
  private isStarted = false;
  private systemMetrics: any = {};
  private applicationMetrics: any = {};

  start(): void {
    if (this.isStarted) return;

    this.isStarted = true;
    logger.info('Starting metrics collection');

    // Collect system metrics every minute
    cron.schedule('* * * * *', () => {
      this.collectSystemMetrics();
    });

    // Collect application metrics every 5 minutes
    cron.schedule('*/5 * * * *', () => {
      this.collectApplicationMetrics();
    });

    // Initial collection
    this.collectSystemMetrics();
    this.collectApplicationMetrics();
  }

  async getSystemMetrics(): Promise<any> {
    return {
      ...this.systemMetrics,
      timestamp: new Date()
    };
  }

  async getApplicationMetrics(): Promise<any> {
    return {
      ...this.applicationMetrics,
      timestamp: new Date()
    };
  }

  async getBusinessMetrics(options: BusinessMetricsOptions): Promise<any> {
    try {
      const startDate = options.startDate || new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endDate = options.endDate || new Date();

      // Get revenue metrics
      const { data: revenueEvents } = await supabase
        .from('business_events')
        .select('*')
        .in('event_type', ['subscription_start', 'purchase'])
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString());

      // Get subscription metrics
      const { data: subscriptionEvents } = await supabase
        .from('business_events')
        .select('*')
        .in('event_type', ['subscription_start', 'subscription_cancel'])
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString());

      // Get user engagement
      const { data: activeUsers } = await supabase
        .from('analytics_events')
        .select('user_id')
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString());

      const totalRevenue = revenueEvents?.reduce((sum, event) => sum + (event.revenue || 0), 0) || 0;
      const subscriptionStarts = subscriptionEvents?.filter(e => e.event_type === 'subscription_start').length || 0;
      const subscriptionCancels = subscriptionEvents?.filter(e => e.event_type === 'subscription_cancel').length || 0;
      const uniqueActiveUsers = new Set(activeUsers?.map(u => u.user_id)).size;

      return {
        revenue: {
          total: totalRevenue,
          average: totalRevenue / Math.max(1, revenueEvents?.length || 1)
        },
        subscriptions: {
          starts: subscriptionStarts,
          cancels: subscriptionCancels,
          net: subscriptionStarts - subscriptionCancels,
          churnRate: subscriptionStarts > 0 ? (subscriptionCancels / subscriptionStarts) * 100 : 0
        },
        users: {
          active: uniqueActiveUsers,
          averageRevenuePerUser: totalRevenue / Math.max(1, uniqueActiveUsers)
        },
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

  async getPrometheusMetrics(): Promise<string> {
    const systemMetrics = await this.getSystemMetrics();
    const appMetrics = await this.getApplicationMetrics();

    let prometheus = '';

    // System metrics
    prometheus += `# HELP system_cpu_usage CPU usage percentage\n`;
    prometheus += `# TYPE system_cpu_usage gauge\n`;
    prometheus += `system_cpu_usage ${systemMetrics.cpu?.usage || 0}\n\n`;

    prometheus += `# HELP system_memory_usage Memory usage percentage\n`;
    prometheus += `# TYPE system_memory_usage gauge\n`;
    prometheus += `system_memory_usage ${systemMetrics.memory?.usagePercent || 0}\n\n`;

    prometheus += `# HELP system_load_average Load average\n`;
    prometheus += `# TYPE system_load_average gauge\n`;
    prometheus += `system_load_average{period="1m"} ${systemMetrics.loadAverage?.[0] || 0}\n`;
    prometheus += `system_load_average{period="5m"} ${systemMetrics.loadAverage?.[1] || 0}\n`;
    prometheus += `system_load_average{period="15m"} ${systemMetrics.loadAverage?.[2] || 0}\n\n`;

    // Application metrics
    prometheus += `# HELP app_requests_total Total number of requests\n`;
    prometheus += `# TYPE app_requests_total counter\n`;
    prometheus += `app_requests_total ${appMetrics.requests?.total || 0}\n\n`;

    prometheus += `# HELP app_errors_total Total number of errors\n`;
    prometheus += `# TYPE app_errors_total counter\n`;
    prometheus += `app_errors_total ${appMetrics.errors?.total || 0}\n\n`;

    prometheus += `# HELP app_response_time_seconds Response time in seconds\n`;
    prometheus += `# TYPE app_response_time_seconds histogram\n`;
    prometheus += `app_response_time_seconds_sum ${appMetrics.responseTime?.sum || 0}\n`;
    prometheus += `app_response_time_seconds_count ${appMetrics.responseTime?.count || 0}\n\n`;

    return prometheus;
  }

  async getHealthMetrics(): Promise<any> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    try {
      // Check error rate
      const { count: totalRequests } = await supabase
        .from('analytics_events')
        .select('*', { count: 'exact', head: true })
        .gte('timestamp', oneHourAgo.toISOString());

      const { count: errorCount } = await supabase
        .from('error_events')
        .select('*', { count: 'exact', head: true })
        .gte('timestamp', oneHourAgo.toISOString());

      const errorRate = totalRequests && totalRequests > 0 ? (errorCount || 0) / totalRequests : 0;

      // Check average response time
      const { data: performanceMetrics } = await supabase
        .from('performance_metrics')
        .select('value')
        .eq('metric_type', 'response_time')
        .gte('timestamp', oneHourAgo.toISOString());

      const avgResponseTime = performanceMetrics && performanceMetrics.length > 0
        ? performanceMetrics.reduce((sum, m) => sum + m.value, 0) / performanceMetrics.length
        : 0;

      const health = {
        status: 'healthy',
        checks: {
          errorRate: {
            status: errorRate < 0.05 ? 'healthy' : 'unhealthy',
            value: errorRate,
            threshold: 0.05
          },
          responseTime: {
            status: avgResponseTime < 200 ? 'healthy' : 'degraded',
            value: avgResponseTime,
            threshold: 200
          },
          systemResources: {
            status: this.systemMetrics.memory?.usagePercent < 90 ? 'healthy' : 'warning',
            cpu: this.systemMetrics.cpu?.usage,
            memory: this.systemMetrics.memory?.usagePercent
          }
        },
        timestamp: now
      };

      // Determine overall status
      if (health.checks.errorRate.status === 'unhealthy' ||
          health.checks.systemResources.status === 'warning') {
        health.status = 'degraded';
      }

      return health;
    } catch (error) {
      logger.error('Failed to get health metrics', { error });
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: now
      };
    }
  }

  private collectSystemMetrics(): void {
    try {
      const memUsage = process.memoryUsage();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;

      this.systemMetrics = {
        cpu: {
          usage: this.getCPUUsage(),
          cores: os.cpus().length
        },
        memory: {
          total: totalMem,
          used: usedMem,
          free: freeMem,
          usagePercent: (usedMem / totalMem) * 100,
          process: {
            rss: memUsage.rss,
            heapTotal: memUsage.heapTotal,
            heapUsed: memUsage.heapUsed,
            external: memUsage.external
          }
        },
        loadAverage: os.loadavg(),
        uptime: process.uptime(),
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version
      };

      logger.debug('System metrics collected', { metrics: this.systemMetrics });
    } catch (error) {
      logger.error('Failed to collect system metrics', { error });
    }
  }

  private async collectApplicationMetrics(): Promise<void> {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // Get request metrics
      const { count: totalRequests } = await supabase
        .from('analytics_events')
        .select('*', { count: 'exact', head: true })
        .gte('timestamp', oneHourAgo.toISOString());

      // Get error metrics
      const { count: totalErrors } = await supabase
        .from('error_events')
        .select('*', { count: 'exact', head: true })
        .gte('timestamp', oneHourAgo.toISOString());

      // Get performance metrics
      const { data: performanceData } = await supabase
        .from('performance_metrics')
        .select('metric_type, value')
        .gte('timestamp', oneHourAgo.toISOString());

      // Calculate response time metrics
      const responseTimeMetrics = performanceData?.filter(p => p.metric_type === 'response_time') || [];
      const avgResponseTime = responseTimeMetrics.length > 0
        ? responseTimeMetrics.reduce((sum, m) => sum + m.value, 0) / responseTimeMetrics.length
        : 0;

      this.applicationMetrics = {
        requests: {
          total: totalRequests || 0,
          rate: (totalRequests || 0) / 60 // requests per minute
        },
        errors: {
          total: totalErrors || 0,
          rate: totalErrors && totalRequests ? (totalErrors / totalRequests) * 100 : 0
        },
        responseTime: {
          average: avgResponseTime,
          sum: responseTimeMetrics.reduce((sum, m) => sum + m.value, 0),
          count: responseTimeMetrics.length
        },
        performance: this.aggregatePerformanceMetrics(performanceData || [])
      };

      logger.debug('Application metrics collected', { metrics: this.applicationMetrics });
    } catch (error) {
      logger.error('Failed to collect application metrics', { error });
    }
  }

  private getCPUUsage(): number {
    // Simple CPU usage calculation
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;

    return 100 - ~~(100 * idle / total);
  }

  private aggregatePerformanceMetrics(metrics: any[]): any {
    const grouped = metrics.reduce((acc, metric) => {
      if (!acc[metric.metric_type]) {
        acc[metric.metric_type] = [];
      }
      acc[metric.metric_type].push(metric.value);
      return acc;
    }, {});

    const aggregated: any = {};
    for (const [type, values] of Object.entries(grouped) as [string, number[]][]) {
      aggregated[type] = {
        average: values.reduce((sum, v) => sum + v, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        count: values.length
      };
    }

    return aggregated;
  }
}
