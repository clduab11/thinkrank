import { createClient } from '@supabase/supabase-js';
import { logger } from '@thinkrank/shared';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: string;
  requirements: {
    type: 'score' | 'contributions' | 'streak' | 'level' | 'research_quality' | 'social';
    threshold: number;
    metadata?: Record<string, any>;
  };
  reward: {
    type: 'badge' | 'points' | 'title';
    value: any;
  };
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  icon?: string;
  isHidden: boolean;
}

export interface UserAchievement {
  achievementId: string;
  achievement: Achievement;
  unlockedAt: string;
  progress?: {
    current: number;
    required: number;
    percentage: number;
  };
}

export interface AchievementProgress {
  achievementId: string;
  userId: string;
  currentValue: number;
  isUnlocked: boolean;
  unlockedAt?: string;
}

class AchievementService {
  private achievements: Achievement[] = [
    // Score-based achievements
    {
      id: 'first_score',
      name: 'First Steps',
      description: 'Score your first points in ThinkRank',
      category: 'progress',
      requirements: { type: 'score', threshold: 1 },
      reward: { type: 'badge', value: 'first_steps' },
      rarity: 'common',
      icon: '🎯',
      isHidden: false
    },
    {
      id: 'score_1000',
      name: 'Rising Researcher',
      description: 'Reach 1,000 total points',
      category: 'progress',
      requirements: { type: 'score', threshold: 1000 },
      reward: { type: 'badge', value: 'rising_researcher' },
      rarity: 'common',
      icon: '📈',
      isHidden: false
    },
    {
      id: 'score_10000',
      name: 'Expert Investigator',
      description: 'Reach 10,000 total points',
      category: 'progress',
      requirements: { type: 'score', threshold: 10000 },
      reward: { type: 'badge', value: 'expert_investigator' },
      rarity: 'rare',
      icon: '🔬',
      isHidden: false
    },
    {
      id: 'score_100000',
      name: 'AI Research Master',
      description: 'Reach 100,000 total points',
      category: 'progress',
      requirements: { type: 'score', threshold: 100000 },
      reward: { type: 'badge', value: 'ai_master' },
      rarity: 'legendary',
      icon: '🏆',
      isHidden: false
    },

    // Contribution-based achievements
    {
      id: 'first_contribution',
      name: 'Research Contributor',
      description: 'Submit your first research contribution',
      category: 'research',
      requirements: { type: 'contributions', threshold: 1 },
      reward: { type: 'badge', value: 'first_contributor' },
      rarity: 'common',
      icon: '🧠',
      isHidden: false
    },
    {
      id: 'contributions_10',
      name: 'Dedicated Researcher',
      description: 'Submit 10 validated contributions',
      category: 'research',
      requirements: { type: 'contributions', threshold: 10 },
      reward: { type: 'badge', value: 'dedicated_researcher' },
      rarity: 'rare',
      icon: '📚',
      isHidden: false
    },
    {
      id: 'contributions_100',
      name: 'Research Pioneer',
      description: 'Submit 100 validated contributions',
      category: 'research',
      requirements: { type: 'contributions', threshold: 100 },
      reward: { type: 'badge', value: 'research_pioneer' },
      rarity: 'epic',
      icon: '🚀',
      isHidden: false
    },

    // Streak achievements
    {
      id: 'streak_3',
      name: 'Consistent Contributor',
      description: 'Maintain a 3-day activity streak',
      category: 'engagement',
      requirements: { type: 'streak', threshold: 3 },
      reward: { type: 'badge', value: 'consistent' },
      rarity: 'common',
      icon: '🔥',
      isHidden: false
    },
    {
      id: 'streak_30',
      name: 'Unstoppable Force',
      description: 'Maintain a 30-day activity streak',
      category: 'engagement',
      requirements: { type: 'streak', threshold: 30 },
      reward: { type: 'badge', value: 'unstoppable' },
      rarity: 'epic',
      icon: '⚡',
      isHidden: false
    },

    // Quality achievements
    {
      id: 'high_quality_10',
      name: 'Quality Researcher',
      description: 'Submit 10 contributions with quality score >0.9',
      category: 'quality',
      requirements: {
        type: 'research_quality',
        threshold: 10,
        metadata: { minQuality: 0.9 }
      },
      reward: { type: 'badge', value: 'quality_researcher' },
      rarity: 'rare',
      icon: '💎',
      isHidden: false
    },

    // Social achievements
    {
      id: 'followers_10',
      name: 'Rising Influencer',
      description: 'Gain 10 followers',
      category: 'social',
      requirements: { type: 'social', threshold: 10, metadata: { type: 'followers' } },
      reward: { type: 'badge', value: 'influencer' },
      rarity: 'rare',
      icon: '👥',
      isHidden: false
    },

    // Level achievements
    {
      id: 'level_10',
      name: 'Experienced Researcher',
      description: 'Reach level 10',
      category: 'progress',
      requirements: { type: 'level', threshold: 10 },
      reward: { type: 'badge', value: 'experienced' },
      rarity: 'common',
      icon: '⭐',
      isHidden: false
    },
    {
      id: 'level_25',
      name: 'Senior Researcher',
      description: 'Reach level 25',
      category: 'progress',
      requirements: { type: 'level', threshold: 25 },
      reward: { type: 'badge', value: 'senior_researcher' },
      rarity: 'rare',
      icon: '🌟',
      isHidden: false
    }
  ];

  async getUserAchievements(userId: string): Promise<UserAchievement[]> {
    try {
      // Get user's current achievements from profile
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('profile_data')
        .eq('id', userId)
        .single();

      if (userError) {
        logger.error('Failed to fetch user achievements', { userId, error: userError.message });
        return [];
      }

      const userAchievements = user.profile_data?.achievements || [];

      return userAchievements.map((achievementId: string) => {
        const achievement = this.achievements.find(a => a.id === achievementId);
        return {
          achievementId,
          achievement: achievement!,
          unlockedAt: new Date().toISOString(), // In production, store actual unlock date
          progress: { current: 100, required: 100, percentage: 100 }
        };
      }).filter((ua: UserAchievement) => ua.achievement);

    } catch (error) {
      logger.error('Error fetching user achievements', { userId, error });
      return [];
    }
  }

  async checkAndUnlockAchievements(userId: string): Promise<Achievement[]> {
    try {
      const newAchievements: Achievement[] = [];

      // Get user's current data
      const [userData, progressData, contributionsData] = await Promise.all([
        this.getUserData(userId),
        this.getUserProgress(userId),
        this.getUserContributions(userId)
      ]);

      if (!userData || !progressData) {
        return newAchievements;
      }

      const currentAchievements = userData.profile_data?.achievements || [];

      // Check each achievement
      for (const achievement of this.achievements) {
        if (currentAchievements.includes(achievement.id)) {
          continue; // Already unlocked
        }

        const isUnlocked = await this.checkAchievementRequirement(
          achievement,
          progressData,
          contributionsData,
          userId
        );

        if (isUnlocked) {
          await this.unlockAchievement(userId, achievement.id, currentAchievements);
          newAchievements.push(achievement);
        }
      }

      return newAchievements;

    } catch (error) {
      logger.error('Error checking achievements', { userId, error });
      return [];
    }
  }

  async getAchievementProgress(userId: string): Promise<AchievementProgress[]> {
    try {
      const [userData, progressData, contributionsData] = await Promise.all([
        this.getUserData(userId),
        this.getUserProgress(userId),
        this.getUserContributions(userId)
      ]);

      if (!userData || !progressData) {
        return [];
      }

      const currentAchievements = userData.profile_data?.achievements || [];

      return this.achievements.map(achievement => ({
        achievementId: achievement.id,
        userId,
        currentValue: this.getCurrentValue(achievement, progressData, contributionsData),
        isUnlocked: currentAchievements.includes(achievement.id),
        unlockedAt: currentAchievements.includes(achievement.id) ? new Date().toISOString() : undefined
      }));

    } catch (error) {
      logger.error('Error getting achievement progress', { userId, error });
      return [];
    }
  }

  private async getUserData(userId: string) {
    const { data, error } = await supabase
      .from('users')
      .select('profile_data')
      .eq('id', userId)
      .single();

    if (error) {
      logger.error('Failed to fetch user data for achievements', { userId, error: error.message });
      return null;
    }

    return data;
  }

  private async getUserProgress(userId: string) {
    const { data, error } = await supabase
      .from('game_progress')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      logger.error('Failed to fetch user progress for achievements', { userId, error: error.message });
      return null;
    }

    return data;
  }

  private async getUserContributions(userId: string) {
    const { data, error } = await supabase
      .from('research_contributions')
      .select('*')
      .eq('user_id', userId)
      .eq('validation_status', 'validated');

    if (error) {
      logger.error('Failed to fetch user contributions for achievements', { userId, error: error.message });
      return [];
    }

    return data || [];
  }

  private async checkAchievementRequirement(
    achievement: Achievement,
    progressData: any,
    contributionsData: any[],
    userId: string
  ): Promise<boolean> {
    const { requirements } = achievement;

    switch (requirements.type) {
      case 'score':
        return progressData.total_score >= requirements.threshold;

      case 'level':
        return progressData.level >= requirements.threshold;

      case 'streak':
        return progressData.current_streak >= requirements.threshold;

      case 'contributions':
        return contributionsData.length >= requirements.threshold;

      case 'research_quality':
        const highQualityContributions = contributionsData.filter(
          c => c.quality_score >= (requirements.metadata?.minQuality || 0.9)
        );
        return highQualityContributions.length >= requirements.threshold;

      case 'social':
        if (requirements.metadata?.type === 'followers') {
          const followerCount = await this.getFollowerCount(userId);
          return followerCount >= requirements.threshold;
        }
        return false;

      default:
        return false;
    }
  }

  private getCurrentValue(
    achievement: Achievement,
    progressData: any,
    contributionsData: any[]
  ): number {
    const { requirements } = achievement;

    switch (requirements.type) {
      case 'score':
        return progressData.total_score || 0;
      case 'level':
        return progressData.level || 1;
      case 'streak':
        return progressData.current_streak || 0;
      case 'contributions':
        return contributionsData.length;
      case 'research_quality':
        return contributionsData.filter(
          c => c.quality_score >= (requirements.metadata?.minQuality || 0.9)
        ).length;
      default:
        return 0;
    }
  }

  private async getFollowerCount(userId: string): Promise<number> {
    const { count } = await supabase
      .from('social_interactions')
      .select('*', { count: 'exact', head: true })
      .eq('target_user_id', userId)
      .eq('interaction_type', 'follow');

    return count || 0;
  }

  private async unlockAchievement(
    userId: string,
    achievementId: string,
    currentAchievements: string[]
  ): Promise<void> {
    const updatedAchievements = [...currentAchievements, achievementId];

    const { error } = await supabase
      .from('users')
      .update({
        profile_data: {
          achievements: updatedAchievements
        }
      })
      .eq('id', userId);

    if (error) {
      logger.error('Failed to unlock achievement', { userId, achievementId, error: error.message });
    } else {
      logger.info('Achievement unlocked', { userId, achievementId });
    }
  }

  getAllAchievements(): Achievement[] {
    return this.achievements.filter(a => !a.isHidden);
  }

  getAchievementById(id: string): Achievement | undefined {
    return this.achievements.find(a => a.id === id);
  }
}

export const achievementService = new AchievementService();
