import { createClient } from '@supabase/supabase-js';
import * as cron from 'node-cron';
import { totalmem, freemem } from 'os';
import { logger } from './logger.service';

const supabaseUrl = process.env['SUPABASE_URL']!;
const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface Alert {
  id?: string;
  type: 'error_rate' | 'performance' | 'system' | 'business';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  threshold?: number;
  currentValue?: number;
  metadata?: any;
  createdAt?: Date;
  resolvedAt?: Date;
  status: 'active' | 'resolved' | 'acknowledged';
}

export interface AlertRule {
  id: string;
  name: string;
  type: string;
  condition: string;
  threshold: number;
  duration: number;
  severity: string;
  enabled: boolean;
  channels: string[];
}

export class AlertingService {
  private isInitialized = false;
  private alertRules: AlertRule[] = [];
  private activeAlerts = new Map<string, Alert>();

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    this.isInitialized = true;
    logger.info('Initializing alerting service');

    // Load alert rules
    await this.loadAlertRules();

    // Start monitoring tasks
    this.startMonitoring();

    logger.info('Alerting service initialized');
  }

  async createAlert(alert: Alert): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('alerts')
        .insert({
          type: alert.type,
          severity: alert.severity,
          title: alert.title,
          message: alert.message,
          threshold: alert.threshold,
          current_value: alert.currentValue,
          metadata: alert.metadata,
          status: alert.status,
          created_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (error) throw error;

      const alertId = data.id;
      this.activeAlerts.set(alertId, { ...alert, id: alertId });

      // Send notifications
      await this.sendAlertNotifications(alert);

      logger.warn('Alert created', {
        alertId,
        type: alert.type,
        severity: alert.severity,
        title: alert.title
      });

      return alertId;
    } catch (error) {
      logger.error('Failed to create alert', { error, alert });
      throw error;
    }
  }

  async resolveAlert(alertId: string, resolvedBy?: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('alerts')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolved_by: resolvedBy
        })
        .eq('id', alertId);

      if (error) throw error;

      this.activeAlerts.delete(alertId);

      logger.info('Alert resolved', { alertId, resolvedBy });
    } catch (error) {
      logger.error('Failed to resolve alert', { error, alertId });
      throw error;
    }
  }

  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('alerts')
        .update({
          status: 'acknowledged',
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: acknowledgedBy
        })
        .eq('id', alertId);

      if (error) throw error;

      const alert = this.activeAlerts.get(alertId);
      if (alert) {
        alert.status = 'acknowledged';
        this.activeAlerts.set(alertId, alert);
      }

      logger.info('Alert acknowledged', { alertId, acknowledgedBy });
    } catch (error) {
      logger.error('Failed to acknowledge alert', { error, alertId });
      throw error;
    }
  }

  async getActiveAlerts(): Promise<Alert[]> {
    try {
      const { data: alerts, error } = await supabase
        .from('alerts')
        .select('*')
        .in('status', ['active', 'acknowledged'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      return alerts?.map(alert => ({
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        threshold: alert.threshold,
        currentValue: alert.current_value,
        metadata: alert.metadata,
        status: alert.status,
        createdAt: new Date(alert.created_at)
      })) || [];
    } catch (error) {
      logger.error('Failed to get active alerts', { error });
      throw error;
    }
  }

  private async loadAlertRules(): Promise<void> {
    // Default alert rules - in production these would be stored in database
    this.alertRules = [
      {
        id: 'error_rate_high',
        name: 'High Error Rate',
        type: 'error_rate',
        condition: 'greater_than',
        threshold: 5, // 5% error rate
        duration: 300, // 5 minutes
        severity: 'high',
        enabled: true,
        channels: ['email', 'slack']
      },
      {
        id: 'response_time_slow',
        name: 'Slow Response Time',
        type: 'performance',
        condition: 'greater_than',
        threshold: 1000, // 1000ms
        duration: 300,
        severity: 'medium',
        enabled: true,
        channels: ['slack']
      },
      {
        id: 'memory_usage_high',
        name: 'High Memory Usage',
        type: 'system',
        condition: 'greater_than',
        threshold: 90, // 90%
        duration: 600, // 10 minutes
        severity: 'high',
        enabled: true,
        channels: ['email', 'slack']
      },
      {
        id: 'subscription_churn_high',
        name: 'High Subscription Churn',
        type: 'business',
        condition: 'greater_than',
        threshold: 10, // 10% daily churn
        duration: 3600, // 1 hour
        severity: 'critical',
        enabled: true,
        channels: ['email', 'slack', 'sms']
      }
    ];

    logger.info('Alert rules loaded', { count: this.alertRules.length });
  }

  private startMonitoring(): void {
    // Check error rate every 5 minutes
    cron.schedule('*/5 * * * *', () => {
      this.checkErrorRate();
    });

    // Check performance every 5 minutes
    cron.schedule('*/5 * * * *', () => {
      this.checkPerformance();
    });

    // Check system metrics every minute
    cron.schedule('* * * * *', () => {
      this.checkSystemMetrics();
    });

    // Check business metrics every hour
    cron.schedule('0 * * * *', () => {
      this.checkBusinessMetrics();
    });

    logger.info('Monitoring tasks started');
  }

  private async checkErrorRate(): Promise<void> {
    try {
      const rule = this.alertRules.find(r => r.id === 'error_rate_high');
      if (!rule || !rule.enabled) return;

      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const now = new Date();

      // Get total events
      const { count: totalEvents } = await supabase
        .from('analytics_events')
        .select('*', { count: 'exact', head: true })
        .gte('timestamp', fiveMinutesAgo.toISOString())
        .lte('timestamp', now.toISOString());

      // Get error events
      const { count: errorEvents } = await supabase
        .from('error_events')
        .select('*', { count: 'exact', head: true })
        .gte('timestamp', fiveMinutesAgo.toISOString())
        .lte('timestamp', now.toISOString());

      if (totalEvents && totalEvents > 0) {
        const errorRate = ((errorEvents || 0) / totalEvents) * 100;

        if (errorRate > rule.threshold) {
          await this.createAlert({
            type: 'error_rate',
            severity: rule.severity as Alert['severity'],
            title: 'High Error Rate Detected',
            message: `Error rate is ${errorRate.toFixed(2)}% (threshold: ${rule.threshold}%)`,
            threshold: rule.threshold,
            currentValue: errorRate,
            status: 'active',
            metadata: {
              totalEvents,
              errorEvents,
              period: '5 minutes'
            }
          });
        }
      }
    } catch (error) {
      logger.error('Failed to check error rate', { error });
    }
  }

  private async checkPerformance(): Promise<void> {
    try {
      const rule = this.alertRules.find(r => r.id === 'response_time_slow');
      if (!rule || !rule.enabled) return;

      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const now = new Date();

      const { data: performanceMetrics } = await supabase
        .from('performance_metrics')
        .select('value')
        .eq('metric_type', 'response_time')
        .gte('timestamp', fiveMinutesAgo.toISOString())
        .lte('timestamp', now.toISOString());

      if (performanceMetrics && performanceMetrics.length > 0) {
        const avgResponseTime = performanceMetrics.reduce((sum, m) => sum + m.value, 0) / performanceMetrics.length;

        if (avgResponseTime > rule.threshold) {
          await this.createAlert({
            type: 'performance',
            severity: rule.severity as Alert['severity'],
            title: 'Slow Response Time Detected',
            message: `Average response time is ${avgResponseTime.toFixed(0)}ms (threshold: ${rule.threshold}ms)`,
            threshold: rule.threshold,
            currentValue: avgResponseTime,
            status: 'active',
            metadata: {
              sampleCount: performanceMetrics.length,
              period: '5 minutes'
            }
          });
        }
      }
    } catch (error) {
      logger.error('Failed to check performance', { error });
    }
  }

  private async checkSystemMetrics(): Promise<void> {
    try {
      const rule = this.alertRules.find(r => r.id === 'memory_usage_high');
      if (!rule || !rule.enabled) return;

      const memUsage = process.memoryUsage();
      const totalMem = totalmem();
      const usedMem = totalMem - freemem();
      const memoryPercent = (usedMem / totalMem) * 100;

      if (memoryPercent > rule.threshold) {
        await this.createAlert({
          type: 'system',
          severity: rule.severity as Alert['severity'],
          title: 'High Memory Usage Detected',
          message: `Memory usage is ${memoryPercent.toFixed(1)}% (threshold: ${rule.threshold}%)`,
          threshold: rule.threshold,
          currentValue: memoryPercent,
          status: 'active',
          metadata: {
            totalMemory: totalMem,
            usedMemory: usedMem,
            processMemory: memUsage
          }
        });
      }
    } catch (error) {
      logger.error('Failed to check system metrics', { error });
    }
  }

  private async checkBusinessMetrics(): Promise<void> {
    try {
      const rule = this.alertRules.find(r => r.id === 'subscription_churn_high');
      if (!rule || !rule.enabled) return;

      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const now = new Date();

      const { data: subscriptionEvents } = await supabase
        .from('business_events')
        .select('event_type')
        .in('event_type', ['subscription_start', 'subscription_cancel'])
        .gte('timestamp', oneDayAgo.toISOString())
        .lte('timestamp', now.toISOString());

      if (subscriptionEvents && subscriptionEvents.length > 0) {
        const starts = subscriptionEvents.filter(e => e.event_type === 'subscription_start').length;
        const cancels = subscriptionEvents.filter(e => e.event_type === 'subscription_cancel').length;
        const churnRate = starts > 0 ? (cancels / starts) * 100 : 0;

        if (churnRate > rule.threshold) {
          await this.createAlert({
            type: 'business',
            severity: rule.severity as Alert['severity'],
            title: 'High Subscription Churn Detected',
            message: `Daily churn rate is ${churnRate.toFixed(1)}% (threshold: ${rule.threshold}%)`,
            threshold: rule.threshold,
            currentValue: churnRate,
            status: 'active',
            metadata: {
              subscriptionStarts: starts,
              subscriptionCancels: cancels,
              period: '24 hours'
            }
          });
        }
      }
    } catch (error) {
      logger.error('Failed to check business metrics', { error });
    }
  }

  private async sendAlertNotifications(alert: Alert): Promise<void> {
    try {
      // In a real implementation, this would send notifications via:
      // - Email (SendGrid, AWS SES, etc.)
      // - Slack (webhook)
      // - SMS (Twilio)
      // - PagerDuty
      // - Discord webhook

      logger.info('Alert notification sent', {
        alertType: alert.type,
        severity: alert.severity,
        title: alert.title,
        // channels would be determined by alert rules
        channels: ['console'] // For now just log
      });

      // Console notification for development
      logger.warn(`🚨 ALERT [${alert.severity.toUpperCase()}]: ${alert.title}`);
      logger.warn(`   ${alert.message}`);
      if (alert.threshold && alert.currentValue) {
        logger.warn(`   Current: ${alert.currentValue}, Threshold: ${alert.threshold}`);
      }
    } catch (error) {
      logger.error('Failed to send alert notifications', { error });
    }
  }
}
