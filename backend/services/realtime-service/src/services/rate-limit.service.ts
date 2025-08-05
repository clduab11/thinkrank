import { RedisManager } from './redis.service';
import { logger } from '@thinkrank/shared';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (identifier: string, action: string) => string;
  onLimitReached?: (identifier: string, action: string) => void;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  current: number;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
}

export class RateLimitManager {
  private defaultConfig: RateLimitConfig = {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60,
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  };

  private actionConfigs: Map<string, RateLimitConfig> = new Map();

  constructor(private redisManager: RedisManager) {
    this.setupDefaultConfigs();
  }

  private setupDefaultConfigs(): void {
    // Connection rate limiting
    this.actionConfigs.set('connection', {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 10, // 10 connections per minute
      onLimitReached: (id, action) => logger.warn(`Connection rate limit exceeded for ${id}`)
    });

    // Game actions
    this.actionConfigs.set('join_game', {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 5, // 5 game joins per minute
      onLimitReached: (id, action) => logger.warn(`Join game rate limit exceeded for ${id}`)
    });

    this.actionConfigs.set('game_action', {
      windowMs: 10 * 1000, // 10 seconds
      maxRequests: 20, // 20 actions per 10 seconds
      onLimitReached: (id, action) => logger.warn(`Game action rate limit exceeded for ${id}`)
    });

    // Messaging
    this.actionConfigs.set('send_message', {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 30, // 30 messages per minute
      onLimitReached: (id, action) => logger.warn(`Message rate limit exceeded for ${id}`)
    });

    // API endpoints
    this.actionConfigs.set('api_request', {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100, // 100 requests per minute
      onLimitReached: (id, action) => logger.warn(`API rate limit exceeded for ${id}`)
    });

    // Authentication attempts
    this.actionConfigs.set('auth_attempt', {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 5, // 5 failed attempts per 15 minutes
      skipSuccessfulRequests: true,
      onLimitReached: (id, action) => logger.warn(`Auth rate limit exceeded for ${id}`)
    });
  }

  async checkRateLimit(identifier: string, action: string): Promise<boolean> {
    const result = await this.getRateLimitStatus(identifier, action);
    return result.allowed;
  }

  async getRateLimitStatus(identifier: string, action: string): Promise<RateLimitResult> {
    const config = this.actionConfigs.get(action) || this.defaultConfig;
    const key = this.generateKey(identifier, action, config);
    const windowStart = Date.now() - config.windowMs;

    try {
      // Use Redis sorted set for sliding window
      const pipeline = this.redisManager.getMainClient().pipeline();
      
      // Remove expired entries
      pipeline.zremrangebyscore(key, '-inf', windowStart);
      
      // Count current requests
      pipeline.zcard(key);
      
      // Add current request
      const requestId = `${Date.now()}-${Math.random()}`;
      pipeline.zadd(key, Date.now(), requestId);
      
      // Set expiration
      pipeline.expire(key, Math.ceil(config.windowMs / 1000));

      const results = await pipeline.exec();
      const currentCount = (results?.[1]?.[1] as number) || 0;

      const allowed = currentCount < config.maxRequests;
      const resetTime = new Date(Date.now() + config.windowMs);
      const remaining = Math.max(0, config.maxRequests - currentCount - 1);

      const result: RateLimitResult = {
        allowed,
        limit: config.maxRequests,
        current: currentCount + 1,
        remaining,
        resetTime
      };

      if (!allowed) {
        result.retryAfter = Math.ceil(config.windowMs / 1000);
        
        // Remove the request we just added since it's not allowed
        await this.redisManager.getMainClient().zrem(key, requestId);
        
        // Call rate limit callback
        if (config.onLimitReached) {
          config.onLimitReached(identifier, action);
        }
      }

      return result;

    } catch (error) {
      logger.error(`Rate limit check failed for ${identifier}:${action}`, error);
      
      // Fail open - allow request if Redis is unavailable
      return {
        allowed: true,
        limit: config.maxRequests,
        current: 0,
        remaining: config.maxRequests,
        resetTime: new Date(Date.now() + config.windowMs)
      };
    }
  }

  async resetRateLimit(identifier: string, action: string): Promise<void> {
    const config = this.actionConfigs.get(action) || this.defaultConfig;
    const key = this.generateKey(identifier, action, config);

    try {
      await this.redisManager.del(key);
      logger.info(`Rate limit reset for ${identifier}:${action}`);
    } catch (error) {
      logger.error(`Failed to reset rate limit for ${identifier}:${action}`, error);
    }
  }

  async incrementRateLimit(identifier:String, action: string, increment: number = 1): Promise<RateLimitResult> {
    const config = this.actionConfigs.get(action) || this.defaultConfig;
    const key = this.generateKey(identifier, action, config);

    try {
      const pipeline = this.redisManager.getMainClient().pipeline();
      
      // Add multiple entries for increment
      for (let i = 0; i < increment; i++) {
        const requestId = `${Date.now()}-${Math.random()}-${i}`;
        pipeline.zadd(key, Date.now(), requestId);
      }
      
      // Clean up expired entries
      const windowStart = Date.now() - config.windowMs;
      pipeline.zremrangebyscore(key, '-inf', windowStart);
      
      // Get current count
      pipeline.zcard(key);
      
      // Set expiration
      pipeline.expire(key, Math.ceil(config.windowMs / 1000));

      const results = await pipeline.exec();
      const currentCount = (results?.[results.length - 2]?.[1] as number) || 0;

      const allowed = currentCount <= config.maxRequests;
      const resetTime = new Date(Date.now() + config.windowMs);
      const remaining = Math.max(0, config.maxRequests - currentCount);

      return {
        allowed,
        limit: config.maxRequests,
        current: currentCount,
        remaining,
        resetTime,
        retryAfter: allowed ? undefined : Math.ceil(config.windowMs / 1000)
      };

    } catch (error) {
      logger.error(`Rate limit increment failed for ${identifier}:${action}`, error);
      throw error;
    }
  }

  setActionConfig(action: string, config: Partial<RateLimitConfig>): void {
    const existingConfig = this.actionConfigs.get(action) || this.defaultConfig;
    this.actionConfigs.set(action, { ...existingConfig, ...config });
  }

  removeActionConfig(action: string): void {
    this.actionConfigs.delete(action);
  }

  private generateKey(identifier: string, action: string, config: RateLimitConfig): string {
    if (config.keyGenerator) {
      return config.keyGenerator(identifier, action);
    }
    return `rate_limit:${action}:${identifier}`;
  }

  // Bulk operations
  async checkMultipleRateLimits(checks: Array<{ identifier: string; action: string }>): Promise<Map<string, RateLimitResult>> {
    const results = new Map<string, RateLimitResult>();
    
    // Process in parallel
    const promises = checks.map(async ({ identifier, action }) => {
      const key = `${identifier}:${action}`;
      const result = await this.getRateLimitStatus(identifier, action);
      return { key, result };
    });

    const completed = await Promise.allSettled(promises);
    
    completed.forEach((promise, index) => {
      if (promise.status === 'fulfilled') {
        results.set(promise.value.key, promise.value.result);
      } else {
        const { identifier, action } = checks[index];
        const key = `${identifier}:${action}`;
        // Fail open
        results.set(key, {
          allowed: true,
          limit: 0,
          current: 0,
          remaining: 0,
          resetTime: new Date()
        });
      }
    });

    return results;
  }

  // Analytics and monitoring
  async getRateLimitStats(action?: string): Promise<{
    totalRequests: number;
    blockedRequests: number;
    topIdentifiers: Array<{ identifier: string; requests: number }>;
  }> {
    try {
      const pattern = action ? `rate_limit:${action}:*` : 'rate_limit:*';
      const keys = await this.redisManager.getMainClient().keys(pattern);
      
      let totalRequests = 0;
      let blockedRequests = 0;
      const identifierCounts = new Map<string, number>();

      for (const key of keys) {
        const count = await this.redisManager.getMainClient().zcard(key);
        totalRequests += count;
        
        // Extract identifier from key
        const parts = key.split(':');
        const identifier = parts[parts.length - 1];
        identifierCounts.set(identifier, (identifierCounts.get(identifier) || 0) + count);
        
        // Check if this identifier is currently rate limited
        const actionName = parts[1];
        const config = this.actionConfigs.get(actionName) || this.defaultConfig;
        if (count >= config.maxRequests) {
          blockedRequests += count - config.maxRequests;
        }
      }

      // Sort identifiers by request count
      const topIdentifiers = Array.from(identifierCounts.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([identifier, requests]) => ({ identifier, requests }));

      return {
        totalRequests,
        blockedRequests,
        topIdentifiers
      };

    } catch (error) {
      logger.error('Failed to get rate limit stats', error);
      return {
        totalRequests: 0,
        blockedRequests: 0,
        topIdentifiers: []
      };
    }
  }

  // Whitelist/Blacklist functionality
  async addToWhitelist(identifier: string, action?: string): Promise<void> {
    const key = action ? `whitelist:${action}:${identifier}` : `whitelist:global:${identifier}`;
    await this.redisManager.set(key, true, 24 * 60 * 60); // 24 hours
    logger.info(`Added ${identifier} to whitelist for ${action || 'global'}`);
  }

  async removeFromWhitelist(identifier: string, action?: string): Promise<void> {
    const key = action ? `whitelist:${action}:${identifier}` : `whitelist:global:${identifier}`;
    await this.redisManager.del(key);
    logger.info(`Removed ${identifier} from whitelist for ${action || 'global'}`);
  }

  async isWhitelisted(identifier: string, action: string): Promise<boolean> {
    const globalKey = `whitelist:global:${identifier}`;
    const actionKey = `whitelist:${action}:${identifier}`;
    
    const [globalWhitelisted, actionWhitelisted] = await Promise.all([
      this.redisManager.exists(globalKey),
      this.redisManager.exists(actionKey)
    ]);

    return globalWhitelisted || actionWhitelisted;
  }

  async addToBlacklist(identifier: string, action?: string, ttl: number = 24 * 60 * 60): Promise<void> {
    const key = action ? `blacklist:${action}:${identifier}` : `blacklist:global:${identifier}`;
    await this.redisManager.set(key, true, ttl);
    logger.info(`Added ${identifier} to blacklist for ${action || 'global'} (TTL: ${ttl}s)`);
  }

  async removeFromBlacklist(identifier: string, action?: string): Promise<void> {
    const key = action ? `blacklist:${action}:${identifier}` : `blacklist:global:${identifier}`;
    await this.redisManager.del(key);
    logger.info(`Removed ${identifier} from blacklist for ${action || 'global'}`);
  }

  async isBlacklisted(identifier: string, action: string): Promise<boolean> {
    const globalKey = `blacklist:global:${identifier}`;
    const actionKey = `blacklist:${action}:${identifier}`;
    
    const [globalBlacklisted, actionBlacklisted] = await Promise.all([
      this.redisManager.exists(globalKey),
      this.redisManager.exists(actionKey)
    ]);

    return globalBlacklisted || actionBlacklisted;
  }

  // Enhanced rate limit check with whitelist/blacklist
  async checkEnhancedRateLimit(identifier: string, action: string): Promise<RateLimitResult> {
    // Check blacklist first
    if (await this.isBlacklisted(identifier, action)) {
      return {
        allowed: false,
        limit: 0,
        current: 1,
        remaining: 0,
        resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        retryAfter: 24 * 60 * 60
      };
    }

    // Check whitelist
    if (await this.isWhitelisted(identifier, action)) {
      return {
        allowed: true,
        limit: Number.MAX_SAFE_INTEGER,
        current: 0,
        remaining: Number.MAX_SAFE_INTEGER,
        resetTime: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // Far future
      };
    }

    // Normal rate limit check
    return await this.getRateLimitStatus(identifier, action);
  }

  // Cleanup expired entries
  async cleanupExpiredEntries(): Promise<number> {
    try {
      const keys = await this.redisManager.getMainClient().keys('rate_limit:*');
      let cleanedCount = 0;

      for (const key of keys) {
        const ttl = await this.redisManager.getMainClient().ttl(key);
        if (ttl === -1) {
          // Key exists but has no expiration, set one
          await this.redisManager.getMainClient().expire(key, 3600); // 1 hour default
        } else if (ttl === -2) {
          // Key doesn't exist, skip
          continue;
        }

        // Clean expired entries within the sorted set
        const now = Date.now();
        const removed = await this.redisManager.getMainClient().zremrangebyscore(key, '-inf', now - 24 * 60 * 60 * 1000);
        cleanedCount += removed;
      }

      if (cleanedCount > 0) {
        logger.info(`Cleaned up ${cleanedCount} expired rate limit entries`);
      }

      return cleanedCount;
    } catch (error) {
      logger.error('Rate limit cleanup failed', error);
      return 0;
    }
  }
}