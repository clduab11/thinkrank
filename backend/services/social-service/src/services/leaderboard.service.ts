import { createClient } from '@supabase/supabase-js';
import { logger } from '@thinkrank/shared';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface LeaderboardEntry {
  userId: string;
  username: string;
  displayName?: string;
  avatar?: string;
  score: number;
  level: number;
  rank: number;
  contributions: number;
  achievements: string[];
  subscription_tier: 'free' | 'premium' | 'pro';
}

export interface LeaderboardFilters {
  category?: 'global' | 'bias_detection' | 'alignment' | 'context_evaluation';
  timeframe?: 'daily' | 'weekly' | 'monthly' | 'all_time';
  tier?: 'free' | 'premium' | 'pro';
  friends_only?: boolean;
}

class LeaderboardService {

  async getGlobalLeaderboard(
    filters: LeaderboardFilters = {},
    limit: number = 100,
    offset: number = 0
  ): Promise<LeaderboardEntry[]> {
    try {
      let query = supabase
        .from('game_progress')
        .select(`
          user_id,
          total_score,
          level,
          achievements,
          users!inner (
            username,
            profile_data,
            subscription_tier
          )
        `)
        .order('total_score', { ascending: false })
        .range(offset, offset + limit - 1);

      // Apply subscription tier filter
      if (filters.tier) {
        query = query.eq('users.subscription_tier', filters.tier);
      }

      const { data: leaderboard, error } = await query;

      if (error) {
        logger.error('Failed to fetch global leaderboard', { error: error.message, filters });
        return [];
      }

      return leaderboard.map((entry: any, index: number) => ({
        userId: entry.user_id,
        username: entry.users.username,
        displayName: entry.users.profile_data?.displayName,
        avatar: entry.users.profile_data?.avatar,
        score: entry.total_score,
        level: entry.level,
        rank: offset + index + 1,
        contributions: 0, // Will be populated separately
        achievements: entry.achievements || [],
        subscription_tier: entry.users.subscription_tier
      }));

    } catch (error) {
      logger.error('Error fetching global leaderboard', { error, filters });
      return [];
    }
  }

  async getResearchCategoryLeaderboard(
    category: 'bias_detection' | 'alignment' | 'context_evaluation',
    filters: LeaderboardFilters = {},
    limit: number = 100,
    offset: number = 0
  ): Promise<LeaderboardEntry[]> {
    try {
      // Get contributions by category and calculate scores
      let query = supabase
        .from('research_contributions')
        .select(`
          user_id,
          points_awarded,
          quality_score,
          users!inner (
            username,
            profile_data,
            subscription_tier
          ),
          ai_research_problems!inner (
            problem_type
          )
        `)
        .eq('ai_research_problems.problem_type', category)
        .eq('validation_status', 'validated');

      // Apply timeframe filter
      if (filters.timeframe && filters.timeframe !== 'all_time') {
        const timeRange = this.getTimeRange(filters.timeframe);
        query = query.gte('submitted_at', timeRange);
      }

      const { data: contributions, error } = await query;

      if (error) {
        logger.error('Failed to fetch category leaderboard', {
          error: error.message,
          category,
          filters
        });
        return [];
      }

      // Aggregate scores by user
      const userScores = new Map<string, {
        user: any;
        totalScore: number;
        contributionCount: number;
      }>();

      contributions.forEach((contrib: any) => {
        const userId = contrib.user_id;
        const score = contrib.points_awarded || 0;

        if (userScores.has(userId)) {
          const existing = userScores.get(userId)!;
          existing.totalScore += score;
          existing.contributionCount += 1;
        } else {
          userScores.set(userId, {
            user: contrib.users,
            totalScore: score,
            contributionCount: 1
          });
        }
      });

      // Convert to array and sort
      const sortedEntries = Array.from(userScores.entries())
        .sort(([, a], [, b]) => b.totalScore - a.totalScore)
        .slice(offset, offset + limit);

      return sortedEntries.map(([userId, data], index) => ({
        userId,
        username: data.user.username,
        displayName: data.user.profile_data?.displayName,
        avatar: data.user.profile_data?.avatar,
        score: data.totalScore,
        level: 1, // Will be fetched separately if needed
        rank: offset + index + 1,
        contributions: data.contributionCount,
        achievements: [],
        subscription_tier: data.user.subscription_tier
      }));

    } catch (error) {
      logger.error('Error fetching category leaderboard', { error, category, filters });
      return [];
    }
  }

  async getFriendsLeaderboard(
    userId: string,
    filters: LeaderboardFilters = {},
    limit: number = 50
  ): Promise<LeaderboardEntry[]> {
    try {
      // Get user's friends (people they follow who also follow them back)
      const { data: friendIds, error: friendsError } = await supabase
        .from('social_interactions')
        .select('target_user_id')
        .eq('user_id', userId)
        .eq('interaction_type', 'follow');

      if (friendsError) {
        logger.error('Failed to fetch friends for leaderboard', {
          userId,
          error: friendsError.message
        });
        return [];
      }

      const friendUserIds = friendIds.map(f => f.target_user_id);
      friendUserIds.push(userId); // Include self

      if (friendUserIds.length === 0) {
        return [];
      }

      // Get leaderboard data for friends
      const { data: leaderboard, error } = await supabase
        .from('game_progress')
        .select(`
          user_id,
          total_score,
          level,
          achievements,
          users!inner (
            username,
            profile_data,
            subscription_tier
          )
        `)
        .in('user_id', friendUserIds)
        .order('total_score', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Failed to fetch friends leaderboard', {
          userId,
          error: error.message
        });
        return [];
      }

      return leaderboard.map((entry: any, index: number) => ({
        userId: entry.user_id,
        username: entry.users.username,
        displayName: entry.users.profile_data?.displayName,
        avatar: entry.users.profile_data?.avatar,
        score: entry.total_score,
        level: entry.level,
        rank: index + 1,
        contributions: 0,
        achievements: entry.achievements || [],
        subscription_tier: entry.users.subscription_tier
      }));

    } catch (error) {
      logger.error('Error fetching friends leaderboard', { error, userId });
      return [];
    }
  }

  async getUserRank(userId: string, category?: string): Promise<{
    globalRank: number;
    categoryRank?: number;
    totalUsers: number;
  } | null> {
    try {
      // Get user's total score
      const { data: userProgress, error: userError } = await supabase
        .from('game_progress')
        .select('total_score')
        .eq('user_id', userId)
        .single();

      if (userError || !userProgress) {
        logger.error('Failed to fetch user progress for rank', {
          userId,
          error: userError?.message
        });
        return null;
      }

      // Count users with higher scores for global rank
      const { count: globalCount, error: globalError } = await supabase
        .from('game_progress')
        .select('*', { count: 'exact', head: true })
        .gt('total_score', userProgress.total_score);

      if (globalError) {
        logger.error('Failed to calculate global rank', {
          userId,
          error: globalError.message
        });
        return null;
      }

      // Get total user count
      const { count: totalUsers, error: totalError } = await supabase
        .from('game_progress')
        .select('*', { count: 'exact', head: true });

      if (totalError) {
        logger.error('Failed to get total user count', {
          userId,
          error: totalError.message
        });
        return null;
      }

      const result = {
        globalRank: (globalCount || 0) + 1,
        totalUsers: totalUsers || 0,
        categoryRank: undefined as number | undefined
      };

      // Calculate category rank if specified
      if (category && ['bias_detection', 'alignment', 'context_evaluation'].includes(category)) {
        const categoryRank = await this.getCategoryRank(userId, category as any);
        result.categoryRank = categoryRank;
      }

      return result;

    } catch (error) {
      logger.error('Error calculating user rank', { error, userId, category });
      return null;
    }
  }

  private async getCategoryRank(
    userId: string,
    category: 'bias_detection' | 'alignment' | 'context_evaluation'
  ): Promise<number> {
    try {
      // Get user's score in category
      const { data: userContributions, error: userError } = await supabase
        .from('research_contributions')
        .select(`
          points_awarded,
          ai_research_problems!inner (
            problem_type
          )
        `)
        .eq('user_id', userId)
        .eq('ai_research_problems.problem_type', category)
        .eq('validation_status', 'validated');

      if (userError) {
        return 0;
      }

      const userScore = userContributions.reduce((sum: number, contrib: any) =>
        sum + (contrib.points_awarded || 0), 0
      );

      // Count users with higher scores in category
      // This is a simplified calculation - in production you'd want to optimize this
      const { data: allCategoryContributions, error: allError } = await supabase
        .from('research_contributions')
        .select(`
          user_id,
          points_awarded,
          ai_research_problems!inner (
            problem_type
          )
        `)
        .eq('ai_research_problems.problem_type', category)
        .eq('validation_status', 'validated');

      if (allError) {
        return 0;
      }

      // Aggregate scores by user
      const userScores = new Map<string, number>();
      allCategoryContributions.forEach((contrib: any) => {
        const score = contrib.points_awarded || 0;
        userScores.set(contrib.user_id, (userScores.get(contrib.user_id) || 0) + score);
      });

      // Count users with higher scores
      let rank = 1;
      for (const [, score] of userScores.entries()) {
        if (score > userScore) {
          rank++;
        }
      }

      return rank;

    } catch (error) {
      logger.error('Error calculating category rank', { error, userId, category });
      return 0;
    }
  }

  private getTimeRange(timeframe: 'daily' | 'weekly' | 'monthly'): string {
    const now = new Date();
    let daysBack = 1;

    switch (timeframe) {
      case 'daily':
        daysBack = 1;
        break;
      case 'weekly':
        daysBack = 7;
        break;
      case 'monthly':
        daysBack = 30;
        break;
    }

    const timeRange = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000));
    return timeRange.toISOString();
  }
}

export const leaderboardService = new LeaderboardService();
