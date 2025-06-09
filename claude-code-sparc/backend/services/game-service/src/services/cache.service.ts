import type Redis from 'ioredis';
import type { ICacheService } from './interfaces/cache.service.interface';

export class CacheService implements ICacheService {
  private readonly DEFAULT_TTL = 300; // 5 minutes

  constructor(private readonly redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      if (!value) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch (error) {
      // Handle JSON parse errors
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const ttlSeconds = ttl || this.DEFAULT_TTL;
    const serialized = JSON.stringify(value);
    await this.redis.setex(key, ttlSeconds, serialized);
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }
}