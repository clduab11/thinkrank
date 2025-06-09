import { createClient } from '@supabase/supabase-js';
import { logger } from '../logger.service';

const supabaseUrl = process.env['SUPABASE_URL']!;
const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface OverviewOptions {
  startDate?: Date;
  endDate?: Date;
}

export class OverviewService {
  async getOverview(options: OverviewOptions): Promise<any> {
    try {
      const { startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), endDate = new Date() } = options;
      
      logger.info('Fetching overview data', { startDate, endDate });

      // Get total users
      const { data: totalUsers, error: usersError } = await supabase
        .from('users')
        .select('id', { count: 'exact' })
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (usersError) {
        logger.error('Error fetching total users', {}, usersError);
        throw new Error('Failed to fetch total users');
      }

      // Get total games played
      const { data: totalGames, error: gamesError } = await supabase
        .from('game_sessions')
        .select('id', { count: 'exact' })
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (gamesError) {
        logger.error('Error fetching total games', {}, gamesError);
        throw new Error('Failed to fetch total games');
      }

      // Get revenue data
      const { data: revenueData, error: revenueError } = await supabase
        .from('subscriptions')
        .select('amount')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .eq('status', 'active');

      if (revenueError) {
        logger.error('Error fetching revenue data', {}, revenueError);
        throw new Error('Failed to fetch revenue data');
      }

      const totalRevenue = revenueData?.reduce((sum, subscription) => sum + subscription.amount, 0) || 0;

      // Get active users (last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const { data: activeUsers, error: activeUsersError } = await supabase
        .from('user_activity')
        .select('user_id', { count: 'exact' })
        .gte('last_activity', sevenDaysAgo.toISOString())
        .lte('last_activity', endDate.toISOString());

      if (activeUsersError) {
        logger.error('Error fetching active users', {}, activeUsersError);
        throw new Error('Failed to fetch active users');
      }

      return {
        totalUsers: totalUsers?.count || 0,
        totalGames: totalGames?.count || 0,
        totalRevenue,
        activeUsers: activeUsers?.count || 0,
        conversionRate: totalUsers?.count ? (revenueData?.length || 0) / totalUsers.count : 0
      };
    } catch (error) {
      logger.error('Error in getOverview', {}, error as Error);
      throw error;
    }
  }
}