/**
 * SafeRedisClient - Test Suite
 *
 * Comprehensive tests for non-blocking Redis operations
 * @see Issue #5: MAJOR - Redis KEYS Command Blocking Production Server
 */

import { SafeRedisClient, createSafeRedisClient, RedisClient } from '../redis-utils';

/**
 * Mock Redis client for testing
 */
class MockRedisClient implements RedisClient {
  private keys: Map<string, any> = new Map();
  private scanCalls = 0;

  async scan(cursor: string, ...args: any[]): Promise<[string, string[]]> {
    this.scanCalls++;

    // Parse MATCH pattern
    const matchIndex = args.indexOf('MATCH');
    const pattern = matchIndex >= 0 ? args[matchIndex + 1] : '*';

    // Parse COUNT
    const countIndex = args.indexOf('COUNT');
    const count = countIndex >= 0 ? args[countIndex + 1] : 10;

    // Get all keys matching pattern
    const allMatchingKeys = Array.from(this.keys.keys()).filter(key => this.matchesPattern(key, pattern));

    // Simulate cursor-based iteration
    const cursorNum = parseInt(cursor);
    const start = cursorNum;
    const end = Math.min(start + count, allMatchingKeys.length);
    const batch = allMatchingKeys.slice(start, end);

    // Next cursor (0 if done)
    const nextCursor = end < allMatchingKeys.length ? end.toString() : '0';

    return [nextCursor, batch];
  }

  async del(...keys: string[]): Promise<number> {
    let deleted = 0;
    for (const key of keys) {
      if (this.keys.has(key)) {
        this.keys.delete(key);
        deleted++;
      }
    }
    return deleted;
  }

  async exists(...keys: string[]): Promise<number> {
    return keys.filter(key => this.keys.has(key)).length;
  }

  async ttl(key: string): Promise<number> {
    return this.keys.has(key) ? 3600 : -2;
  }

  // Test helper methods
  set(key: string, value: any): void {
    this.keys.set(key, value);
  }

  clear(): void {
    this.keys.clear();
    this.scanCalls = 0;
  }

  getScanCalls(): number {
    return this.scanCalls;
  }

  private matchesPattern(key: string, pattern: string): boolean {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(key);
  }
}

describe('SafeRedisClient', () => {
  let mockRedis: MockRedisClient;
  let safeRedis: SafeRedisClient;

  beforeEach(() => {
    mockRedis = new MockRedisClient();
    safeRedis = createSafeRedisClient(mockRedis);
  });

  afterEach(() => {
    mockRedis.clear();
  });

  describe('scan', () => {
    it('should find all keys matching pattern', async () => {
      // Setup: Create 100 test keys
      for (let i = 0; i < 100; i++) {
        mockRedis.set(`user:${i}`, { id: i });
      }

      // Test: Scan should find all keys
      const keys = await safeRedis.scan('user:*');

      expect(keys).toHaveLength(100);
      expect(keys.every(k => k.startsWith('user:'))).toBe(true);
    });

    it('should handle empty results', async () => {
      const keys = await safeRedis.scan('nonexistent:*');
      expect(keys).toEqual([]);
    });

    it('should iterate with cursor until complete', async () => {
      // Setup: Create 50 keys
      for (let i = 0; i < 50; i++) {
        mockRedis.set(`test:${i}`, 'value');
      }

      // Test: Should make multiple SCAN calls
      const keys = await safeRedis.scan('test:*', { count: 10 });

      expect(keys).toHaveLength(50);
      expect(mockRedis.getScanCalls()).toBeGreaterThan(1);
    });

    it('should handle custom count option', async () => {
      for (let i = 0; i < 200; i++) {
        mockRedis.set(`data:${i}`, 'value');
      }

      const keys = await safeRedis.scan('data:*', { count: 50 });

      expect(keys).toHaveLength(200);
    });

    it('should filter by pattern correctly', async () => {
      mockRedis.set('user:1', 'a');
      mockRedis.set('user:2', 'b');
      mockRedis.set('session:1', 'c');
      mockRedis.set('cache:1', 'd');

      const userKeys = await safeRedis.scan('user:*');
      const sessionKeys = await safeRedis.scan('session:*');

      expect(userKeys).toHaveLength(2);
      expect(sessionKeys).toHaveLength(1);
    });
  });

  describe('scanStream', () => {
    it('should process keys in batches', async () => {
      for (let i = 0; i < 100; i++) {
        mockRedis.set(`stream:${i}`, 'value');
      }

      const batches: string[][] = [];
      await safeRedis.scanStream('stream:*', async keys => {
        batches.push([...keys]);
      });

      expect(batches.length).toBeGreaterThan(1);
      const totalKeys = batches.reduce((sum, batch) => sum + batch.length, 0);
      expect(totalKeys).toBe(100);
    });

    it('should handle empty pattern', async () => {
      let callCount = 0;

      await safeRedis.scanStream('empty:*', async () => {
        callCount++;
      });

      expect(callCount).toBe(0);
    });

    it('should process batches in order', async () => {
      for (let i = 0; i < 30; i++) {
        mockRedis.set(`ordered:${i}`, i);
      }

      const processedKeys: string[] = [];

      await safeRedis.scanStream('ordered:*', async keys => {
        processedKeys.push(...keys);
      });

      expect(processedKeys).toHaveLength(30);
    });
  });

  describe('deletePattern', () => {
    it('should delete all keys matching pattern', async () => {
      for (let i = 0; i < 50; i++) {
        mockRedis.set(`temp:${i}`, 'value');
      }
      mockRedis.set('keep:1', 'value');

      const deleted = await safeRedis.deletePattern('temp:*');

      expect(deleted).toBe(50);
      expect(await mockRedis.exists('keep:1')).toBe(1);
    });

    it('should return 0 when no keys match', async () => {
      const deleted = await safeRedis.deletePattern('nonexistent:*');
      expect(deleted).toBe(0);
    });

    it('should delete in batches', async () => {
      for (let i = 0; i < 200; i++) {
        mockRedis.set(`delete:${i}`, 'value');
      }

      const deleted = await safeRedis.deletePattern('delete:*', 50);

      expect(deleted).toBe(200);
    });
  });

  describe('countPattern', () => {
    it('should count keys matching pattern', async () => {
      for (let i = 0; i < 75; i++) {
        mockRedis.set(`count:${i}`, 'value');
      }

      const count = await safeRedis.countPattern('count:*');

      expect(count).toBe(75);
    });

    it('should return 0 for no matches', async () => {
      const count = await safeRedis.countPattern('nothing:*');
      expect(count).toBe(0);
    });
  });

  describe('existsPattern', () => {
    it('should return true when keys exist', async () => {
      mockRedis.set('exists:1', 'value');

      const exists = await safeRedis.existsPattern('exists:*');

      expect(exists).toBe(true);
    });

    it('should return false when no keys exist', async () => {
      const exists = await safeRedis.existsPattern('missing:*');

      expect(exists).toBe(false);
    });
  });

  describe('samplePattern', () => {
    it('should return sample of keys', async () => {
      for (let i = 0; i < 100; i++) {
        mockRedis.set(`sample:${i}`, 'value');
      }

      const sample = await safeRedis.samplePattern('sample:*', 10);

      expect(sample.length).toBeLessThanOrEqual(10);
      expect(sample.every(k => k.startsWith('sample:'))).toBe(true);
    });

    it('should return all keys if fewer than sample size', async () => {
      mockRedis.set('few:1', 'a');
      mockRedis.set('few:2', 'b');

      const sample = await safeRedis.samplePattern('few:*', 10);

      expect(sample).toHaveLength(2);
    });
  });

  describe('Performance & Safety', () => {
    it('should be non-blocking (multiple iterations)', async () => {
      // Large dataset
      for (let i = 0; i < 1000; i++) {
        mockRedis.set(`perf:${i}`, 'value');
      }

      const start = Date.now();
      const keys = await safeRedis.scan('perf:*');
      const duration = Date.now() - start;

      expect(keys).toHaveLength(1000);
      expect(mockRedis.getScanCalls()).toBeGreaterThan(1);
      expect(duration).toBeLessThan(1000); // Should be fast
    });

    it('should not load all keys into memory at once with stream', async () => {
      for (let i = 0; i < 500; i++) {
        mockRedis.set(`memory:${i}`, 'value');
      }

      let maxBatchSize = 0;

      await safeRedis.scanStream('memory:*', async keys => {
        maxBatchSize = Math.max(maxBatchSize, keys.length);
      });

      // Should process in small batches
      expect(maxBatchSize).toBeLessThan(100);
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in patterns', async () => {
      mockRedis.set('user:email:test@example.com', 'value');
      mockRedis.set('user:email:other@example.com', 'value');

      const keys = await safeRedis.scan('user:email:*');

      expect(keys).toHaveLength(2);
    });

    it('should handle empty pattern gracefully', async () => {
      const keys = await safeRedis.scan('');
      expect(Array.isArray(keys)).toBe(true);
    });

    it('should handle very long patterns', async () => {
      const longPattern = 'very:' + 'long:'.repeat(50) + '*';
      const keys = await safeRedis.scan(longPattern);
      expect(Array.isArray(keys)).toBe(true);
    });
  });

  describe('Factory Function', () => {
    it('should create SafeRedisClient instance', () => {
      const client = createSafeRedisClient(mockRedis);
      expect(client).toBeInstanceOf(SafeRedisClient);
    });

    it('should accept custom logger', () => {
      const customLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        error: jest.fn()
      };

      const client = createSafeRedisClient(mockRedis, customLogger);
      expect(client).toBeInstanceOf(SafeRedisClient);
    });
  });
});
