import { createClient } from '@supabase/supabase-js';
import moment from 'moment';
import { logger } from '../logger.service';

const supabaseUrl = process.env['SUPABASE_URL']!;
const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface EngagementOptions {
  period: string;
  granularity: string;
}

export class EngagementService {
  async getEngagementMetrics(options: EngagementOptions): Promise<any> {
    try {
      const { period, granularity } = options;
      
      logger.info('Fetching engagement metrics', { period, granularity });

      // Calculate date range based on period
      const endDate = new Date();
      const startDate = new Date();
      
      switch (period) {
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

      // Get user activity data
      const { data: userActivity, error: activityError } = await supabase
        .from('user_activity')
        .select('*')
        .gte('last_activity', startDate.toISOString())
        .lte('last_activity', endDate.toISOString());

      if (activityError) {
        logger.error('Error fetching user activity', {}, activityError);
        throw new Error('Failed to fetch user activity');
      }

      // Calculate engagement metrics
      const totalSessions = userActivity?.length || 0;
      const uniqueUsers = new Set(userActivity?.map(activity => activity.user_id)).size;
      const averageSessionDuration = userActivity?.reduce((sum, activity) => {
        return sum + (activity.session_duration || 0);
      }, 0) / totalSessions || 0;

      return {
        totalSessions,
        uniqueUsers,
        averageSessionDuration,
        sessionsPerUser: uniqueUsers > 0 ? totalSessions / uniqueUsers : 0
      };
    } catch (error) {
      logger.error('Error in getEngagementMetrics', {}, error as Error);
      throw error;
    }
  }
}