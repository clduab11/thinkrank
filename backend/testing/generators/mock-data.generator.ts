/**
 * Mock Data Generator - November 2025 Standards
 * Realistic test data generation for all services
 *
 * FEATURES:
 * - User profiles with realistic data
 * - Game states and player progressions
 * - Research contributions and challenges
 * - Leaderboard data
 * - Achievement and badge data
 * - Social interactions
 */

import { faker } from '@faker-js/faker';

export class MockDataGenerator {
  /**
   * Generate mock user profile
   */
  static generateUser(overrides?: Partial<MockUser>): MockUser {
    return {
      id: faker.string.uuid(),
      email: faker.internet.email(),
      username: faker.internet.userName(),
      displayName: faker.person.fullName(),
      avatar: faker.image.avatar(),
      createdAt: faker.date.past({ years: 2 }),
      lastLoginAt: faker.date.recent({ days: 7 }),
      emailVerified: faker.datatype.boolean({ probability: 0.9 }),
      level: faker.number.int({ min: 1, max: 50 }),
      experience: faker.number.int({ min: 0, max: 50000 }),
      tier: faker.helpers.arrayElement(['bronze', 'silver', 'gold', 'platinum', 'diamond']),
      settings: {
        language: 'en',
        theme: faker.helpers.arrayElement(['light', 'dark', 'auto']),
        notifications: {
          email: faker.datatype.boolean(),
          push: faker.datatype.boolean(),
          inApp: true
        }
      },
      ...overrides
    };
  }

  /**
   * Generate batch of users
   */
  static generateUsers(count: number): MockUser[] {
    return Array.from({ length: count }, () => this.generateUser());
  }

  /**
   * Generate mock player gamification profile
   */
  static generateGamificationProfile(userId: string, overrides?: Partial<MockGamificationProfile>): MockGamificationProfile {
    const challengesCompleted = faker.number.int({ min: 0, max: 500 });
    const currentStreak = faker.number.int({ min: 0, max: 100 });

    return {
      userId,
      totalPoints: faker.number.int({ min: 0, max: 100000 }),
      level: faker.number.int({ min: 1, max: 50 }),
      experience: faker.number.int({ min: 0, max: 5000 }),
      experienceToNextLevel: faker.number.int({ min: 0, max: 2000 }),
      currentStreak,
      longestStreak: Math.max(currentStreak, faker.number.int({ min: currentStreak, max: 200 })),
      lastActivityDate: faker.date.recent({ days: 1 }),
      statistics: {
        challengesCompleted,
        accuracyAverage: faker.number.float({ min: 60, max: 100, precision: 0.01 }),
        researchContributions: faker.number.int({ min: 0, max: 100 }),
        socialShares: faker.number.int({ min: 0, max: 200 }),
        gachaPulls: faker.number.int({ min: 0, max: 1000 }),
        collectionCompletionPercentage: faker.number.float({ min: 0, max: 100, precision: 0.1 }),
        totalPlaytime: faker.number.int({ min: 0, max: 10000 }), // minutes
        rankingPosition: faker.number.int({ min: 1, max: 10000 })
      },
      achievements: this.generateAchievements(5),
      badges: this.generateBadges(8),
      ...overrides
    };
  }

  /**
   * Generate mock achievements
   */
  static generateAchievements(count: number): MockAchievement[] {
    const achievementTemplates = [
      { id: 'first_steps', name: 'First Steps', description: 'Complete your first challenge', tier: 'bronze' },
      { id: 'ai_novice', name: 'AI Novice', description: 'Complete 10 AI challenges', tier: 'silver' },
      { id: 'research_pioneer', name: 'Research Pioneer', description: 'Publish 5 research contributions', tier: 'gold' },
      { id: 'perfectionist', name: 'Perfectionist', description: 'Maintain 95% accuracy', tier: 'platinum' },
      { id: 'streak_master', name: 'Streak Master', description: 'Maintain a 30-day streak', tier: 'diamond' },
      { id: 'social_butterfly', name: 'Social Butterfly', description: 'Share 50 achievements', tier: 'gold' },
      { id: 'collector', name: 'Avid Collector', description: 'Complete 50% collection', tier: 'platinum' }
    ];

    return faker.helpers.arrayElements(achievementTemplates, count).map(template => ({
      ...template,
      rarity: faker.helpers.arrayElement(['common', 'uncommon', 'rare', 'epic', 'legendary']),
      icon: `${template.id}.png`,
      unlockedAt: faker.date.past({ years: 1 }),
      progress: 100,
      rewards: {
        experience: faker.number.int({ min: 100, max: 5000 }),
        currency: faker.number.int({ min: 50, max: 2500 }),
        badges: [`${template.tier}_${template.id}`]
      }
    }));
  }

  /**
   * Generate mock badges
   */
  static generateBadges(count: number): MockBadge[] {
    return Array.from({ length: count }, (_, i) => ({
      id: faker.string.uuid(),
      name: faker.helpers.arrayElement([
        'Bronze Beginner',
        'Silver Scholar',
        'Gold Graduate',
        'Platinum Professor',
        'Diamond Doctor',
        'AI Enthusiast',
        'Research Rockstar',
        'Social Superstar'
      ]),
      tier: faker.helpers.arrayElement(['bronze', 'silver', 'gold', 'platinum', 'diamond']),
      earnedAt: faker.date.past({ years: 1 }),
      displayOrder: i + 1
    }));
  }

  /**
   * Generate mock challenge
   */
  static generateChallenge(overrides?: Partial<MockChallenge>): MockChallenge {
    const types = ['multiple_choice', 'code_analysis', 'bias_detection', 'prompt_crafting', 'model_comparison'];
    const categories = ['bias_detection', 'llm_fundamentals', 'prompt_engineering', 'ai_ethics', 'model_evaluation'];

    return {
      id: faker.string.uuid(),
      type: faker.helpers.arrayElement(types),
      category: faker.helpers.arrayElement(categories),
      difficulty: faker.number.int({ min: 1, max: 10 }),
      question: faker.lorem.sentence({ min: 10, max: 20 }),
      options: Array.from({ length: 4 }, () => faker.lorem.sentence()),
      correctAnswer: faker.helpers.arrayElement(['A', 'B', 'C', 'D']),
      explanation: faker.lorem.paragraph(),
      points: faker.number.int({ min: 100, max: 1000 }),
      timeLimit: faker.number.int({ min: 30, max: 300 }), // seconds
      hints: Array.from({ length: 3 }, () => faker.lorem.sentence()),
      tags: faker.helpers.arrayElements(['AI', 'ML', 'NLP', 'CV', 'Ethics', 'Bias'], 3),
      createdAt: faker.date.past({ years: 1 }),
      ...overrides
    };
  }

  /**
   * Generate batch of challenges
   */
  static generateChallenges(count: number): MockChallenge[] {
    return Array.from({ length: count }, () => this.generateChallenge());
  }

  /**
   * Generate mock leaderboard entry
   */
  static generateLeaderboardEntry(rank: number, overrides?: Partial<MockLeaderboardEntry>): MockLeaderboardEntry {
    return {
      userId: faker.string.uuid(),
      username: faker.internet.userName(),
      displayName: faker.person.fullName(),
      avatar: faker.image.avatar(),
      score: faker.number.int({ min: 1000, max: 100000 }),
      rank,
      percentile: Math.round(((1000 - rank) / 1000) * 100),
      change: faker.number.int({ min: -50, max: 50 }),
      badges: this.generateBadges(3).map(b => b.id),
      level: faker.number.int({ min: 1, max: 50 }),
      streak: faker.number.int({ min: 0, max: 100 }),
      ...overrides
    };
  }

  /**
   * Generate leaderboard
   */
  static generateLeaderboard(size: number): MockLeaderboardEntry[] {
    return Array.from({ length: size }, (_, i) => this.generateLeaderboardEntry(i + 1));
  }

  /**
   * Generate mock research contribution
   */
  static generateResearchContribution(overrides?: Partial<MockResearchContribution>): MockResearchContribution {
    return {
      id: faker.string.uuid(),
      userId: faker.string.uuid(),
      title: faker.lorem.sentence({ min: 5, max: 15 }),
      abstract: faker.lorem.paragraphs(2),
      category: faker.helpers.arrayElement(['bias_detection', 'llm_fundamentals', 'prompt_engineering', 'ai_ethics']),
      methodology: faker.lorem.paragraph(),
      findings: faker.lorem.paragraphs(3),
      citations: faker.number.int({ min: 0, max: 100 }),
      status: faker.helpers.arrayElement(['draft', 'submitted', 'under_review', 'published', 'rejected']),
      validationStatus: faker.helpers.arrayElement(['pending', 'validated', 'disputed']),
      pointsAwarded: faker.number.int({ min: 100, max: 5000 }),
      createdAt: faker.date.past({ years: 2 }),
      publishedAt: faker.date.recent({ days: 30 }),
      tags: faker.helpers.arrayElements(['AI', 'ML', 'NLP', 'Ethics', 'Fairness', 'Bias'], 4),
      ...overrides
    };
  }

  /**
   * Generate batch of research contributions
   */
  static generateResearchContributions(count: number): MockResearchContribution[] {
    return Array.from({ length: count }, () => this.generateResearchContribution());
  }

  /**
   * Generate mock game state
   */
  static generateGameState(overrides?: Partial<MockGameState>): MockGameState {
    return {
      gameId: faker.string.uuid(),
      players: this.generateUsers(4).map(user => ({
        playerId: user.id,
        level: user.level,
        experience: user.experience,
        score: faker.number.int({ min: 0, max: 10000 }),
        lastActive: faker.date.recent({ days: 1 })
      })),
      currentPhase: faker.helpers.arrayElement(['waiting', 'active', 'paused', 'completed']),
      startedAt: faker.date.recent({ days: 7 }),
      boardState: {
        currentRound: faker.number.int({ min: 1, max: 10 }),
        maxRounds: 10,
        activeChallenge: this.generateChallenge().id
      },
      timestamp: new Date(),
      version: faker.number.int({ min: 1, max: 100 }),
      ...overrides
    };
  }

  /**
   * Generate mock social interaction
   */
  static generateSocialInteraction(overrides?: Partial<MockSocialInteraction>): MockSocialInteraction {
    return {
      id: faker.string.uuid(),
      userId: faker.string.uuid(),
      targetUserId: faker.string.uuid(),
      type: faker.helpers.arrayElement(['friend_request', 'message', 'share', 'like', 'comment']),
      content: faker.lorem.sentence(),
      platform: faker.helpers.arrayElement(['facebook', 'twitter', 'linkedin', 'discord']),
      timestamp: faker.date.recent({ days: 7 }),
      metadata: {
        achievementId: faker.string.uuid(),
        score: faker.number.int({ min: 0, max: 10000 })
      },
      ...overrides
    };
  }

  /**
   * Generate complete test dataset
   */
  static generateCompleteTestDataset(config: {
    users: number;
    challenges: number;
    researchContributions: number;
    gameStates: number;
  }): MockTestDataset {
    const users = this.generateUsers(config.users);

    return {
      users,
      gamificationProfiles: users.map(u => this.generateGamificationProfile(u.id)),
      challenges: this.generateChallenges(config.challenges),
      leaderboard: this.generateLeaderboard(100),
      researchContributions: this.generateResearchContributions(config.researchContributions),
      gameStates: Array.from({ length: config.gameStates }, () => this.generateGameState()),
      socialInteractions: Array.from({ length: 50 }, () => this.generateSocialInteraction())
    };
  }
}

// Type definitions
export interface MockUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatar: string;
  createdAt: Date;
  lastLoginAt: Date;
  emailVerified: boolean;
  level: number;
  experience: number;
  tier: string;
  settings: {
    language: string;
    theme: string;
    notifications: {
      email: boolean;
      push: boolean;
      inApp: boolean;
    };
  };
}

export interface MockGamificationProfile {
  userId: string;
  totalPoints: number;
  level: number;
  experience: number;
  experienceToNextLevel: number;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: Date;
  statistics: {
    challengesCompleted: number;
    accuracyAverage: number;
    researchContributions: number;
    socialShares: number;
    gachaPulls: number;
    collectionCompletionPercentage: number;
    totalPlaytime: number;
    rankingPosition: number;
  };
  achievements: MockAchievement[];
  badges: MockBadge[];
}

export interface MockAchievement {
  id: string;
  name: string;
  description: string;
  tier: string;
  rarity: string;
  icon: string;
  unlockedAt: Date;
  progress: number;
  rewards: {
    experience: number;
    currency: number;
    badges: string[];
  };
}

export interface MockBadge {
  id: string;
  name: string;
  tier: string;
  earnedAt: Date;
  displayOrder: number;
}

export interface MockChallenge {
  id: string;
  type: string;
  category: string;
  difficulty: number;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  points: number;
  timeLimit: number;
  hints: string[];
  tags: string[];
  createdAt: Date;
}

export interface MockLeaderboardEntry {
  userId: string;
  username: string;
  displayName: string;
  avatar: string;
  score: number;
  rank: number;
  percentile: number;
  change: number;
  badges: string[];
  level: number;
  streak: number;
}

export interface MockResearchContribution {
  id: string;
  userId: string;
  title: string;
  abstract: string;
  category: string;
  methodology: string;
  findings: string;
  citations: number;
  status: string;
  validationStatus: string;
  pointsAwarded: number;
  createdAt: Date;
  publishedAt: Date;
  tags: string[];
}

export interface MockGameState {
  gameId: string;
  players: Array<{
    playerId: string;
    level: number;
    experience: number;
    score: number;
    lastActive: Date;
  }>;
  currentPhase: string;
  startedAt: Date;
  boardState: {
    currentRound: number;
    maxRounds: number;
    activeChallenge: string;
  };
  timestamp: Date;
  version: number;
}

export interface MockSocialInteraction {
  id: string;
  userId: string;
  targetUserId: string;
  type: string;
  content: string;
  platform: string;
  timestamp: Date;
  metadata: {
    achievementId?: string;
    score?: number;
  };
}

export interface MockTestDataset {
  users: MockUser[];
  gamificationProfiles: MockGamificationProfile[];
  challenges: MockChallenge[];
  leaderboard: MockLeaderboardEntry[];
  researchContributions: MockResearchContribution[];
  gameStates: MockGameState[];
  socialInteractions: MockSocialInteraction[];
}
