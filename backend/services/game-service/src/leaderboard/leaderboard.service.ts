/**
 * Leaderboard Service - November 2025 Standards
 * High-performance leaderboard with Redis backing and SQL window functions
 *
 * FEATURES:
 * - Global, regional, and category-specific leaderboards
 * - Real-time updates via Redis sorted sets
 * - Pagination and filtering
 * - Percentile rankings
 * - Historical tracking
 * - Friend leaderboards
 */

import { Logger } from '@thinkrank/shared';
import Redis from 'ioredis';
import { EventEmitter } from 'events';

export interface LeaderboardEntry {
  userId: string;
  username: string;
  displayName: string;
  avatar?: string;
  score: number;
  rank: number;
  percentile: number;
  change: number; // Position change from last update
  badges: string[];
  level: number;
  streak: number;
}

export interface LeaderboardQuery {
  type: 'global' | 'regional' | 'category' | 'friends';
  category?: string;
  region?: string;
  friendIds?: string[];
  period: 'daily' | 'weekly' | 'monthly' | 'all_time';
  limit: number;
  offset: number;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  totalPlayers: number;
  userRank?: LeaderboardEntry;
  period: string;
  lastUpdated: Date;
}

export class LeaderboardService extends EventEmitter {
  private logger: Logger;
  private redis: Redis;
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly UPDATE_BATCH_SIZE = 100;

  constructor(redisUrl: string) {
    super();
    this.redis = new Redis(redisUrl);
    this.logger = Logger.create({
      service: 'leaderboard-service',
      level: 'INFO',
      console_enabled: true,
      file_enabled: false,
      structured: true
    });

    this.setupEventListeners();
  }

  /**
   * Setup event listeners for real-time updates
   */
  private setupEventListeners(): void {
    this.on('score:updated', async (event: { userId: string; score: number; category?: string }) => {
      await this.updatePlayerScore(event.userId, event.score, event.category);
    });
  }

  /**
   * Get leaderboard with filtering and pagination
   * Optimized with Redis ZREVRANGE for O(log(N)+M) complexity
   */
  async getLeaderboard(query: LeaderboardQuery, requestingUserId?: string): Promise<LeaderboardResponse> {
    const startTime = Date.now();

    try {
      const leaderboardKey = this.getLeaderboardKey(query);

      // Get total player count
      const totalPlayers = await this.redis.zcard(leaderboardKey);

      // Get leaderboard entries with scores
      const entries: LeaderboardEntry[] = [];

      if (query.type === 'friends' && query.friendIds && query.friendIds.length > 0) {
        // Get scores for specific users (friends)
        entries.push(...await this.getFriendLeaderboard(leaderboardKey, query.friendIds));
      } else {
        // Get top entries with pagination
        const results = await this.redis.zrevrange(
          leaderboardKey,
          query.offset,
          query.offset + query.limit - 1,
          'WITHSCORES'
        );

        // Parse results (format: [userId1, score1, userId2, score2, ...])
        for (let i = 0; i < results.length; i += 2) {
          const userId = results[i];
          const score = parseFloat(results[i + 1]);
          const rank = query.offset + (i / 2) + 1;

          // Get user details from cache or database
          const userDetails = await this.getUserDetails(userId);

          entries.push({
            userId,
            ...userDetails,
            score,
            rank,
            percentile: this.calculatePercentile(rank, totalPlayers),
            change: await this.getRankChange(userId, leaderboardKey),
          });
        }
      }

      // Get requesting user's rank if provided
      let userRank: LeaderboardEntry | undefined;
      if (requestingUserId) {
        userRank = await this.getUserRank(requestingUserId, leaderboardKey, totalPlayers);
      }

      const response: LeaderboardResponse = {
        entries,
        totalPlayers,
        userRank,
        period: query.period,
        lastUpdated: new Date()
      };

      const duration = Date.now() - startTime;
      this.logger.info('Leaderboard query completed', {
        type: query.type,
        period: query.period,
        entriesCount: entries.length,
        duration
      });

      return response;

    } catch (error) {
      this.logger.error('Leaderboard query failed', {}, error);
      throw error;
    }
  }

  /**
   * Update player score in leaderboard
   * Uses Redis ZADD for atomic updates
   */
  async updatePlayerScore(
    userId: string,
    score: number,
    category?: string
  ): Promise<void> {
    try {
      const updates: Promise<any>[] = [];

      // Update global leaderboard
      updates.push(this.redis.zadd('leaderboard:global:all_time', score, userId));
      updates.push(this.redis.zadd(`leaderboard:global:daily:${this.getTodayKey()}`, score, userId));
      updates.push(this.redis.zadd(`leaderboard:global:weekly:${this.getWeekKey()}`, score, userId));
      updates.push(this.redis.zadd(`leaderboard:global:monthly:${this.getMonthKey()}`, score, userId));

      // Update category leaderboard if provided
      if (category) {
        updates.push(this.redis.zadd(`leaderboard:category:${category}:all_time`, score, userId));
        updates.push(this.redis.zadd(`leaderboard:category:${category}:daily:${this.getTodayKey()}`, score, userId));
      }

      // Store previous rank for change calculation
      updates.push(this.savePreviousRank(userId, 'leaderboard:global:all_time'));

      await Promise.all(updates);

      this.logger.debug('Player score updated', { userId, score, category });

    } catch (error) {
      this.logger.error('Failed to update player score', { userId, score }, error);
      throw error;
    }
  }

  /**
   * Get friend leaderboard
   */
  private async getFriendLeaderboard(
    leaderboardKey: string,
    friendIds: string[]
  ): Promise<LeaderboardEntry[]> {
    const entries: LeaderboardEntry[] = [];

    // Use pipeline for batch operations
    const pipeline = this.redis.pipeline();

    for (const userId of friendIds) {
      pipeline.zscore(leaderboardKey, userId);
      pipeline.zrevrank(leaderboardKey, userId);
    }

    const results = await pipeline.exec();

    if (!results) {
      return entries;
    }

    const totalPlayers = await this.redis.zcard(leaderboardKey);

    // Parse results in pairs (score, rank)
    for (let i = 0; i < friendIds.length; i++) {
      const userId = friendIds[i];
      const scoreResult = results[i * 2];
      const rankResult = results[i * 2 + 1];

      if (scoreResult && scoreResult[1] !== null) {
        const score = parseFloat(scoreResult[1] as string);
        const rank = (rankResult[1] as number) + 1; // Redis ranks are 0-indexed

        const userDetails = await this.getUserDetails(userId);

        entries.push({
          userId,
          ...userDetails,
          score,
          rank,
          percentile: this.calculatePercentile(rank, totalPlayers),
          change: await this.getRankChange(userId, leaderboardKey),
        });
      }
    }

    // Sort by rank
    return entries.sort((a, b) => a.rank - b.rank);
  }

  /**
   * Get user's current rank
   */
  private async getUserRank(
    userId: string,
    leaderboardKey: string,
    totalPlayers: number
  ): Promise<LeaderboardEntry | undefined> {
    const score = await this.redis.zscore(leaderboardKey, userId);

    if (score === null) {
      return undefined;
    }

    const rank = await this.redis.zrevrank(leaderboardKey, userId);

    if (rank === null) {
      return undefined;
    }

    const userDetails = await this.getUserDetails(userId);

    return {
      userId,
      ...userDetails,
      score: parseFloat(score),
      rank: rank + 1, // Redis ranks are 0-indexed
      percentile: this.calculatePercentile(rank + 1, totalPlayers),
      change: await this.getRankChange(userId, leaderboardKey),
    };
  }

  /**
   * Get user details (cached)
   */
  private async getUserDetails(userId: string): Promise<{
    username: string;
    displayName: string;
    avatar?: string;
    badges: string[];
    level: number;
    streak: number;
  }> {
    const cacheKey = `user:details:${userId}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    // Fetch from database (placeholder - would integrate with user service)
    const details = {
      username: `user_${userId}`,
      displayName: `Player ${userId}`,
      avatar: undefined,
      badges: [],
      level: 1,
      streak: 0
    };

    // Cache for 5 minutes
    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(details));

    return details;
  }

  /**
   * Calculate percentile ranking
   */
  private calculatePercentile(rank: number, totalPlayers: number): number {
    if (totalPlayers === 0) return 0;
    return Math.round(((totalPlayers - rank + 1) / totalPlayers) * 100);
  }

  /**
   * Get rank change from previous period
   */
  private async getRankChange(userId: string, leaderboardKey: string): Promise<number> {
    const previousRankKey = `${leaderboardKey}:previous:${userId}`;
    const previousRank = await this.redis.get(previousRankKey);

    if (!previousRank) {
      return 0;
    }

    const currentRank = await this.redis.zrevrank(leaderboardKey, userId);

    if (currentRank === null) {
      return 0;
    }

    return parseInt(previousRank) - (currentRank + 1);
  }

  /**
   * Save previous rank for change calculation
   */
  private async savePreviousRank(userId: string, leaderboardKey: string): Promise<void> {
    const rank = await this.redis.zrevrank(leaderboardKey, userId);

    if (rank !== null) {
      await this.redis.setex(
        `${leaderboardKey}:previous:${userId}`,
        86400, // 24 hours
        (rank + 1).toString()
      );
    }
  }

  /**
   * Get leaderboard key based on query
   */
  private getLeaderboardKey(query: LeaderboardQuery): string {
    const parts = ['leaderboard'];

    parts.push(query.type);

    if (query.category) {
      parts.push(query.category);
    }

    if (query.region) {
      parts.push(query.region);
    }

    parts.push(query.period);

    if (query.period === 'daily') {
      parts.push(this.getTodayKey());
    } else if (query.period === 'weekly') {
      parts.push(this.getWeekKey());
    } else if (query.period === 'monthly') {
      parts.push(this.getMonthKey());
    }

    return parts.join(':');
  }

  /**
   * Get today's date key (YYYY-MM-DD)
   */
  private getTodayKey(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Get current week key (YYYY-WW)
   */
  private getWeekKey(): string {
    const now = new Date();
    const weekNumber = this.getWeekNumber(now);
    return `${now.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
  }

  /**
   * Get current month key (YYYY-MM)
   */
  private getMonthKey(): string {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  }

  /**
   * Get ISO week number
   */
  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  /**
   * Cleanup expired leaderboards
   */
  async cleanupExpiredLeaderboards(): Promise<void> {
    const patterns = [
      'leaderboard:*:daily:*',
      'leaderboard:*:weekly:*',
      'leaderboard:*:monthly:*'
    ];

    for (const pattern of patterns) {
      const keys = await this.redis.keys(pattern);

      for (const key of keys) {
        const ttl = await this.redis.ttl(key);

        if (ttl === -1) { // No expiration set
          // Set expiration based on key type
          if (key.includes(':daily:')) {
            await this.redis.expire(key, 86400 * 7); // 7 days
          } else if (key.includes(':weekly:')) {
            await this.redis.expire(key, 86400 * 30); // 30 days
          } else if (key.includes(':monthly:')) {
            await this.redis.expire(key, 86400 * 90); // 90 days
          }
        }
      }
    }

    this.logger.info('Leaderboard cleanup completed');
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}
