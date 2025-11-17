/**
 * Safe Redis Client Utility
 *
 * Provides non-blocking Redis operations using SCAN instead of KEYS.
 * Prevents production server hangs and performance degradation.
 *
 * ⚠️ CRITICAL: NEVER use redis.keys() in production!
 * - KEYS command blocks Redis server (O(N) complexity)
 * - Can cause cascading failures under load
 * - Use SCAN for non-blocking iteration
 *
 * @see Issue #5: MAJOR - Redis KEYS Command Blocking Production Server
 * @created 2024-11-16
 */

/**
 * Scan options configuration
 */
export interface ScanOptions {
  /** Number of keys to return per iteration (default: 100) */
  count?: number;
  /** Filter by key type (string, list, set, zset, hash, stream) */
  type?: 'string' | 'list' | 'set' | 'zset' | 'hash' | 'stream';
}

/**
 * Logger interface (simplified)
 */
interface Logger {
  info(message: string, context?: any): void;
  warn(message: string, context?: any): void;
  debug(message: string, context?: any): void;
  error(message: string, context?: any): void;
}

/**
 * Simple console logger
 */
class ConsoleLogger implements Logger {
  constructor(private name: string) {}

  info(message: string, context?: any): void {
    console.log(`[INFO] [${this.name}] ${message}`, context || '');
  }

  warn(message: string, context?: any): void {
    console.warn(`[WARN] [${this.name}] ${message}`, context || '');
  }

  debug(message: string, context?: any): void {
    console.debug(`[DEBUG] [${this.name}] ${message}`, context || '');
  }

  error(message: string, context?: any): void {
    console.error(`[ERROR] [${this.name}] ${message}`, context || '');
  }
}

/**
 * Simplified Redis interface
 * Compatible with ioredis and node-redis
 */
export interface RedisClient {
  scan(cursor: string, ...args: any[]): Promise<[string, string[]]>;
  del(...keys: string[]): Promise<number>;
  exists(...keys: string[]): Promise<number>;
  ttl(key: string): Promise<number>;
}

/**
 * Safe Redis Client
 *
 * Provides non-blocking Redis operations using SCAN instead of KEYS.
 * All operations are production-safe and won't block the Redis server.
 *
 * @example
 * ```typescript
 * import { createSafeRedisClient } from '@shared/utils/redis-utils';
 *
 * const safeRedis = createSafeRedisClient(redis);
 *
 * // Non-blocking pattern matching
 * const keys = await safeRedis.scan('leaderboard:*');
 *
 * // Streaming with callback
 * await safeRedis.scanStream('cache:*', async (batch) => {
 *   console.log(`Processing ${batch.length} keys`);
 * });
 * ```
 */
export class SafeRedisClient {
  private logger: Logger;
  private readonly MAX_ITERATIONS = 10000; // Safety limit

  constructor(
    private redis: RedisClient,
    logger?: Logger
  ) {
    this.logger = logger || new ConsoleLogger('safe-redis');
  }

  /**
   * Non-blocking pattern matching using SCAN
   *
   * ✅ SAFE: Uses SCAN (non-blocking)
   * ❌ AVOID: redis.keys() (blocks server)
   *
   * @param pattern - Pattern to match (e.g., 'user:*')
   * @param options - Scan configuration options
   * @returns Array of matching keys
   *
   * @example
   * ```typescript
   * // Find all leaderboard keys
   * const keys = await safeRedis.scan('leaderboard:*');
   *
   * // Find all Redis strings only
   * const stringKeys = await safeRedis.scan('data:*', { type: 'string' });
   *
   * // Use larger batch size for better performance
   * const keys = await safeRedis.scan('large:*', { count: 1000 });
   * ```
   */
  async scan(pattern: string, options: ScanOptions = {}): Promise<string[]> {
    const { count = 100, type } = options;
    const keys: string[] = [];
    let cursor = '0';
    let iterations = 0;

    const startTime = Date.now();

    do {
      // Build SCAN arguments
      const args: any[] = [cursor, 'MATCH', pattern, 'COUNT', count];
      if (type) {
        args.push('TYPE', type);
      }

      try {
        const [nextCursor, batch] = await this.redis.scan(...args);
        keys.push(...batch);
        cursor = nextCursor;
        iterations++;

        // Safety limit to prevent infinite loops
        if (iterations >= this.MAX_ITERATIONS) {
          this.logger.warn('SCAN reached maximum iterations', {
            pattern,
            keysFound: keys.length,
            iterations,
            maxIterations: this.MAX_ITERATIONS
          });
          break;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error('SCAN operation failed', {
          pattern,
          error: errorMessage,
          iteration: iterations
        });
        throw error;
      }
    } while (cursor !== '0');

    const duration = Date.now() - startTime;

    this.logger.debug('SCAN completed', {
      pattern,
      keysFound: keys.length,
      iterations,
      durationMs: duration,
      avgKeysPerIteration: Math.round(keys.length / iterations)
    });

    return keys;
  }

  /**
   * Scan with streaming callback for memory-efficient processing
   *
   * Processes keys in batches without loading all into memory.
   * Ideal for large datasets or processing operations.
   *
   * @param pattern - Pattern to match
   * @param callback - Function to process each batch
   * @param options - Scan configuration options
   *
   * @example
   * ```typescript
   * // Process keys in batches
   * await safeRedis.scanStream('session:*', async (keys) => {
   *   // Check TTL and cleanup expired sessions
   *   for (const key of keys) {
   *     const ttl = await redis.ttl(key);
   *     if (ttl < 0) {
   *       await redis.del(key);
   *     }
   *   }
   * });
   * ```
   */
  async scanStream(
    pattern: string,
    callback: (keys: string[]) => Promise<void>,
    options: ScanOptions = {}
  ): Promise<void> {
    const { count = 100, type } = options;
    let cursor = '0';
    let iterations = 0;
    let totalKeys = 0;

    const startTime = Date.now();

    do {
      const args: any[] = [cursor, 'MATCH', pattern, 'COUNT', count];
      if (type) {
        args.push('TYPE', type);
      }

      const [nextCursor, batch] = await this.redis.scan(...args);

      if (batch.length > 0) {
        await callback(batch);
        totalKeys += batch.length;
      }

      cursor = nextCursor;
      iterations++;

      if (iterations >= this.MAX_ITERATIONS) {
        this.logger.warn('SCAN stream reached maximum iterations', {
          pattern,
          totalKeys,
          iterations
        });
        break;
      }
    } while (cursor !== '0');

    const duration = Date.now() - startTime;

    this.logger.debug('SCAN stream completed', {
      pattern,
      totalKeys,
      iterations,
      durationMs: duration
    });
  }

  /**
   * Delete all keys matching a pattern (using SCAN)
   *
   * ✅ SAFE: Non-blocking deletion with batching
   * ❌ AVOID: Deleting all keys at once (can block)
   *
   * @param pattern - Pattern to match for deletion
   * @param batchSize - Number of keys to delete at once (default: 100)
   * @returns Number of keys deleted
   *
   * @example
   * ```typescript
   * // Delete all expired cache entries
   * const deleted = await safeRedis.deletePattern('cache:expired:*');
   * console.log(`Deleted ${deleted} cache entries`);
   * ```
   */
  async deletePattern(pattern: string, batchSize = 100): Promise<number> {
    let deletedCount = 0;

    await this.scanStream(pattern, async (keys) => {
      if (keys.length === 0) return;

      // Delete in batches to avoid blocking
      for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize);
        const deleted = await this.redis.del(...batch);
        deletedCount += deleted;
      }
    });

    this.logger.info('Deleted keys by pattern', {
      pattern,
      deletedCount
    });

    return deletedCount;
  }

  /**
   * Count keys matching a pattern (using SCAN)
   *
   * @param pattern - Pattern to match
   * @returns Number of matching keys
   *
   * @example
   * ```typescript
   * const count = await safeRedis.countPattern('user:*');
   * console.log(`Found ${count} users`);
   * ```
   */
  async countPattern(pattern: string): Promise<number> {
    const keys = await this.scan(pattern);
    return keys.length;
  }

  /**
   * Check if any keys match a pattern
   *
   * More efficient than counting when you just need to know if keys exist.
   *
   * @param pattern - Pattern to match
   * @returns True if at least one key matches
   *
   * @example
   * ```typescript
   * if (await safeRedis.exists Pattern('lock:*')) {
   *   console.log('Some locks are active');
   * }
   * ```
   */
  async existsPattern(pattern: string): Promise<boolean> {
    let cursor = '0';

    const [nextCursor, batch] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 10);

    return batch.length > 0;
  }

  /**
   * Get sample of keys matching pattern (fast)
   *
   * Returns a small sample without scanning all keys.
   * Useful for debugging or quick checks.
   *
   * @param pattern - Pattern to match
   * @param sampleSize - Maximum number of keys to return
   * @returns Sample of matching keys
   */
  async samplePattern(pattern: string, sampleSize = 10): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';

    // Only scan until we have enough samples
    while (keys.length < sampleSize) {
      const [nextCursor, batch] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', sampleSize);

      keys.push(...batch.slice(0, sampleSize - keys.length));

      if (nextCursor === '0' || keys.length >= sampleSize) {
        break;
      }

      cursor = nextCursor;
    }

    return keys.slice(0, sampleSize);
  }
}

/**
 * Factory function to create a SafeRedisClient
 *
 * @param redis - Redis client instance
 * @param logger - Optional logger instance
 * @returns SafeRedisClient instance
 *
 * @example
 * ```typescript
 * import Redis from 'ioredis';
 * import { createSafeRedisClient } from '@shared/utils/redis-utils';
 *
 * const redis = new Redis();
 * const safeRedis = createSafeRedisClient(redis);
 * ```
 */
export function createSafeRedisClient(
  redis: RedisClient,
  logger?: Logger
): SafeRedisClient {
  return new SafeRedisClient(redis, logger);
}
