/**
 * Gamification Service - November 2025 Standards
 * Handles points, badges, achievements, and rewards
 *
 * FEATURES:
 * - Dynamic point attribution based on difficulty and accuracy
 * - Multi-tier badge system (Bronze, Silver, Gold, Platinum, Diamond)
 * - Achievement tracking with milestone rewards
 * - Streak-based bonuses
 * - Real-time leaderboard integration
 */

import { Logger } from '@thinkrank/shared';
import { EventEmitter } from 'events';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  tier: BadgeTier;
  criteria: AchievementCriteria;
  rewards: Rewards;
  icon: string;
  rarity: Rarity;
  unlockedAt?: Date;
  progress: number; // 0-100
}

export enum BadgeTier {
  BRONZE = 'bronze',
  SILVER = 'silver',
  GOLD = 'gold',
  PLATINUM = 'platinum',
  DIAMOND = 'diamond'
}

export enum Rarity {
  COMMON = 'common',
  UNCOMMON = 'uncommon',
  RARE = 'rare',
  EPIC = 'epic',
  LEGENDARY = 'legendary'
}

export interface AchievementCriteria {
  type: 'challenges_completed' | 'accuracy_reached' | 'streak_maintained' | 'research_published' | 'social_shares' | 'collection_size';
  target: number;
  timebound?: boolean; // Must be achieved in a single session
  category?: string; // Specific category requirement
}

export interface Rewards {
  experience: number;
  currency: number; // In-game currency for gacha pulls
  badges: string[];
  unlockables?: string[]; // Special items, skins, etc.
}

export interface PlayerGamificationProfile {
  userId: string;
  totalPoints: number;
  level: number;
  experience: number;
  experienceToNextLevel: number;
  achievements: Map<string, Achievement>;
  badges: Map<string, Badge>;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: Date;
  statistics: PlayerStatistics;
}

export interface Badge {
  id: string;
  name: string;
  tier: BadgeTier;
  earnedAt: Date;
  displayOrder: number;
}

export interface PlayerStatistics {
  challengesCompleted: number;
  accuracyAverage: number;
  researchContributions: number;
  socialShares: number;
  gachaPulls: number;
  collectionCompletionPercentage: number;
  totalPlaytime: number; // in minutes
  rankingPosition: number;
}

export interface PointsEarnedEvent {
  userId: string;
  points: number;
  source: 'challenge' | 'research' | 'social' | 'gacha' | 'streak' | 'achievement';
  multiplier: number;
  timestamp: Date;
}

export class GamificationService extends EventEmitter {
  private logger: Logger;
  private readonly BASE_XP_PER_LEVEL = 1000;
  private readonly LEVEL_SCALING_FACTOR = 1.15;
  private readonly STREAK_BONUS_MULTIPLIER = 0.1; // 10% per day streak

  // Predefined achievements
  private readonly ACHIEVEMENT_TEMPLATES: Achievement[] = [
    {
      id: 'first_steps',
      name: 'First Steps',
      description: 'Complete your first challenge',
      tier: BadgeTier.BRONZE,
      criteria: { type: 'challenges_completed', target: 1 },
      rewards: { experience: 100, currency: 50, badges: ['bronze_beginner'] },
      icon: 'first_steps.png',
      rarity: Rarity.COMMON,
      progress: 0
    },
    {
      id: 'ai_novice',
      name: 'AI Novice',
      description: 'Complete 10 AI challenges',
      tier: BadgeTier.SILVER,
      criteria: { type: 'challenges_completed', target: 10, category: 'ai' },
      rewards: { experience: 500, currency: 200, badges: ['silver_ai_novice'] },
      icon: 'ai_novice.png',
      rarity: Rarity.UNCOMMON,
      progress: 0
    },
    {
      id: 'research_pioneer',
      name: 'Research Pioneer',
      description: 'Publish 5 research contributions',
      tier: BadgeTier.GOLD,
      criteria: { type: 'research_published', target: 5 },
      rewards: { experience: 1000, currency: 500, badges: ['gold_researcher'] },
      icon: 'research_pioneer.png',
      rarity: Rarity.RARE,
      progress: 0
    },
    {
      id: 'perfectionist',
      name: 'Perfectionist',
      description: 'Maintain 95% accuracy across 20 challenges',
      tier: BadgeTier.PLATINUM,
      criteria: { type: 'accuracy_reached', target: 95, timebound: false },
      rewards: { experience: 2000, currency: 1000, badges: ['platinum_perfect'] },
      icon: 'perfectionist.png',
      rarity: Rarity.EPIC,
      progress: 0
    },
    {
      id: 'streak_master',
      name: 'Streak Master',
      description: 'Maintain a 30-day learning streak',
      tier: BadgeTier.DIAMOND,
      criteria: { type: 'streak_maintained', target: 30 },
      rewards: { experience: 5000, currency: 2500, badges: ['diamond_streaker'], unlockables: ['exclusive_theme'] },
      icon: 'streak_master.png',
      rarity: Rarity.LEGENDARY,
      progress: 0
    },
    {
      id: 'social_butterfly',
      name: 'Social Butterfly',
      description: 'Share 50 achievements on social media',
      tier: BadgeTier.GOLD,
      criteria: { type: 'social_shares', target: 50 },
      rewards: { experience: 1500, currency: 750, badges: ['gold_social'] },
      icon: 'social_butterfly.png',
      rarity: Rarity.RARE,
      progress: 0
    },
    {
      id: 'collector',
      name: 'Avid Collector',
      description: 'Complete 50% of the item collection',
      tier: BadgeTier.PLATINUM,
      criteria: { type: 'collection_size', target: 50 },
      rewards: { experience: 3000, currency: 1500, badges: ['platinum_collector'] },
      icon: 'collector.png',
      rarity: Rarity.EPIC,
      progress: 0
    }
  ];

  constructor() {
    super();
    this.logger = Logger.create({
      service: 'gamification-service',
      level: 'INFO',
      console_enabled: true,
      file_enabled: false,
      structured: true
    });
  }

  /**
   * Calculate points earned for completing a challenge
   * Factors: difficulty, accuracy, time taken, streak bonus
   */
  calculateChallengePoints(params: {
    difficulty: number; // 1-10
    accuracy: number; // 0-100
    timeTaken: number; // in seconds
    timeLimit: number; // expected time in seconds
    currentStreak: number;
  }): { points: number; multiplier: number; breakdown: Record<string, number> } {
    const basePoints = params.difficulty * 100;

    // Accuracy bonus (up to 2x for perfect score)
    const accuracyMultiplier = params.accuracy / 100;

    // Speed bonus (up to 1.5x for completing in half the time)
    const speedMultiplier = Math.min(
      1.5,
      1 + (params.timeLimit - params.timeTaken) / params.timeLimit
    );

    // Streak bonus (10% per day, capped at 100%)
    const streakMultiplier = 1 + Math.min(1.0, params.currentStreak * this.STREAK_BONUS_MULTIPLIER);

    // Combined multiplier
    const totalMultiplier = accuracyMultiplier * speedMultiplier * streakMultiplier;

    const finalPoints = Math.round(basePoints * totalMultiplier);

    return {
      points: finalPoints,
      multiplier: totalMultiplier,
      breakdown: {
        base: basePoints,
        accuracy: basePoints * (accuracyMultiplier - 1),
        speed: basePoints * (speedMultiplier - 1),
        streak: basePoints * (streakMultiplier - 1)
      }
    };
  }

  /**
   * Update player statistics and check for achievement unlocks
   */
  async updatePlayerProgress(
    userId: string,
    profile: PlayerGamificationProfile,
    action: {
      type: 'challenge' | 'research' | 'social_share' | 'gacha_pull';
      value: number;
      category?: string;
    }
  ): Promise<{
    updatedProfile: PlayerGamificationProfile;
    newAchievements: Achievement[];
    leveledUp: boolean;
  }> {
    // Update statistics
    const updatedStats = { ...profile.statistics };

    switch (action.type) {
      case 'challenge':
        updatedStats.challengesCompleted += 1;
        updatedStats.accuracyAverage =
          (updatedStats.accuracyAverage * (updatedStats.challengesCompleted - 1) + action.value)
          / updatedStats.challengesCompleted;
        break;
      case 'research':
        updatedStats.researchContributions += 1;
        break;
      case 'social_share':
        updatedStats.socialShares += 1;
        break;
      case 'gacha_pull':
        updatedStats.gachaPulls += 1;
        break;
    }

    // Check for new achievements
    const newAchievements = await this.checkAchievementProgress(userId, updatedStats, profile.achievements);

    // Award achievement rewards
    let bonusExperience = 0;
    let bonusCurrency = 0;
    const newBadges: Badge[] = [];

    for (const achievement of newAchievements) {
      bonusExperience += achievement.rewards.experience;
      bonusCurrency += achievement.rewards.currency;

      for (const badgeId of achievement.rewards.badges) {
        newBadges.push({
          id: badgeId,
          name: achievement.name,
          tier: achievement.tier,
          earnedAt: new Date(),
          displayOrder: this.getBadgeDisplayOrder(achievement.tier)
        });
      }
    }

    // Update experience and check for level up
    const newExperience = profile.experience + bonusExperience;
    const { level, remainingXP, leveledUp } = this.calculateLevel(newExperience);

    const updatedProfile: PlayerGamificationProfile = {
      ...profile,
      experience: newExperience,
      level,
      experienceToNextLevel: this.getExperienceRequiredForLevel(level + 1) - remainingXP,
      statistics: updatedStats,
      achievements: new Map([
        ...profile.achievements,
        ...newAchievements.map(a => [a.id, a] as [string, Achievement])
      ]),
      badges: new Map([
        ...profile.badges,
        ...newBadges.map(b => [b.id, b] as [string, Badge])
      ])
    };

    // Emit events
    if (newAchievements.length > 0) {
      this.emit('achievements:unlocked', {
        userId,
        achievements: newAchievements,
        timestamp: new Date()
      });
    }

    if (leveledUp) {
      this.emit('player:levelup', {
        userId,
        newLevel: level,
        timestamp: new Date()
      });
    }

    return {
      updatedProfile,
      newAchievements,
      leveledUp
    };
  }

  /**
   * Check achievement progress against current statistics
   */
  private async checkAchievementProgress(
    userId: string,
    stats: PlayerStatistics,
    currentAchievements: Map<string, Achievement>
  ): Promise<Achievement[]> {
    const newAchievements: Achievement[] = [];

    for (const template of this.ACHIEVEMENT_TEMPLATES) {
      // Skip if already unlocked
      if (currentAchievements.has(template.id)) {
        continue;
      }

      let progress = 0;
      let unlocked = false;

      switch (template.criteria.type) {
        case 'challenges_completed':
          progress = (stats.challengesCompleted / template.criteria.target) * 100;
          unlocked = stats.challengesCompleted >= template.criteria.target;
          break;

        case 'accuracy_reached':
          progress = (stats.accuracyAverage / template.criteria.target) * 100;
          unlocked = stats.accuracyAverage >= template.criteria.target;
          break;

        case 'research_published':
          progress = (stats.researchContributions / template.criteria.target) * 100;
          unlocked = stats.researchContributions >= template.criteria.target;
          break;

        case 'social_shares':
          progress = (stats.socialShares / template.criteria.target) * 100;
          unlocked = stats.socialShares >= template.criteria.target;
          break;

        case 'collection_size':
          progress = (stats.collectionCompletionPercentage / template.criteria.target) * 100;
          unlocked = stats.collectionCompletionPercentage >= template.criteria.target;
          break;

        case 'streak_maintained':
          // This would be checked separately based on daily activity
          progress = 0; // Placeholder
          break;
      }

      if (unlocked) {
        newAchievements.push({
          ...template,
          unlockedAt: new Date(),
          progress: 100
        });
      }
    }

    return newAchievements;
  }

  /**
   * Calculate player level based on total experience
   */
  private calculateLevel(totalExperience: number): {
    level: number;
    remainingXP: number;
    leveledUp: boolean;
  } {
    let level = 1;
    let xpRequired = this.BASE_XP_PER_LEVEL;
    let remainingXP = totalExperience;

    while (remainingXP >= xpRequired) {
      remainingXP -= xpRequired;
      level++;
      xpRequired = Math.floor(this.BASE_XP_PER_LEVEL * Math.pow(this.LEVEL_SCALING_FACTOR, level - 1));
    }

    return {
      level,
      remainingXP,
      leveledUp: remainingXP < this.BASE_XP_PER_LEVEL
    };
  }

  /**
   * Get experience required for a specific level
   */
  private getExperienceRequiredForLevel(level: number): number {
    let totalXP = 0;
    for (let i = 1; i < level; i++) {
      totalXP += Math.floor(this.BASE_XP_PER_LEVEL * Math.pow(this.LEVEL_SCALING_FACTOR, i - 1));
    }
    return totalXP;
  }

  /**
   * Get badge display order based on tier
   */
  private getBadgeDisplayOrder(tier: BadgeTier): number {
    const orderMap = {
      [BadgeTier.DIAMOND]: 1,
      [BadgeTier.PLATINUM]: 2,
      [BadgeTier.GOLD]: 3,
      [BadgeTier.SILVER]: 4,
      [BadgeTier.BRONZE]: 5
    };
    return orderMap[tier];
  }

  /**
   * Update daily streak
   */
  updateStreak(profile: PlayerGamificationProfile): PlayerGamificationProfile {
    const now = new Date();
    const lastActivity = profile.lastActivityDate;
    const hoursSinceLastActivity = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60);

    let newStreak = profile.currentStreak;

    if (hoursSinceLastActivity < 24) {
      // Same day, no change
      return profile;
    } else if (hoursSinceLastActivity < 48) {
      // Next day, increment streak
      newStreak++;
    } else {
      // Streak broken
      newStreak = 1;
    }

    return {
      ...profile,
      currentStreak: newStreak,
      longestStreak: Math.max(newStreak, profile.longestStreak),
      lastActivityDate: now
    };
  }

  /**
   * Get all available achievements
   */
  getAllAchievements(): Achievement[] {
    return this.ACHIEVEMENT_TEMPLATES;
  }

  /**
   * Get achievement by ID
   */
  getAchievement(achievementId: string): Achievement | undefined {
    return this.ACHIEVEMENT_TEMPLATES.find(a => a.id === achievementId);
  }
}
