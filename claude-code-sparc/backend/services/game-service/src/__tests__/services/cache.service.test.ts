import { CacheService } from '../../services/cache.service';
import type Redis from 'ioredis';

jest.mock('ioredis');

describe('CacheService', () => {
  let cacheService: CacheService;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    mockRedis = {
      get: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
    } as any;

    cacheService = new CacheService(mockRedis);
  });

  describe('get', () => {
    it('should return parsed value when key exists', async () => {
      const key = 'test:key';
      const value = { id: '123', name: 'Test' };
      
      mockRedis.get.mockResolvedValue(JSON.stringify(value));

      const result = await cacheService.get(key);

      expect(mockRedis.get).toHaveBeenCalledWith(key);
      expect(result).toEqual(value);
    });

    it('should return null when key does not exist', async () => {
      const key = 'nonexistent:key';
      
      mockRedis.get.mockResolvedValue(null);

      const result = await cacheService.get(key);

      expect(result).toBeNull();
    });

    it('should handle JSON parse errors gracefully', async () => {
      const key = 'invalid:json';
      
      mockRedis.get.mockResolvedValue('invalid json {');

      const result = await cacheService.get(key);

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should set value with TTL', async () => {
      const key = 'test:key';
      const value = { id: '123', name: 'Test' };
      const ttl = 3600;

      await cacheService.set(key, value, ttl);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        key,
        ttl,
        JSON.stringify(value)
      );
    });

    it('should set value with default TTL when not specified', async () => {
      const key = 'test:key';
      const value = { id: '123', name: 'Test' };

      await cacheService.set(key, value);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        key,
        300, // Default TTL
        JSON.stringify(value)
      );
    });

    it('should handle complex objects', async () => {
      const key = 'complex:key';
      const value = {
        nested: {
          array: [1, 2, 3],
          date: new Date().toISOString(),
        },
        boolean: true,
      };

      await cacheService.set(key, value, 1800);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        key,
        1800,
        JSON.stringify(value)
      );
    });
  });

  describe('delete', () => {
    it('should delete a key', async () => {
      const key = 'test:key';

      await cacheService.delete(key);

      expect(mockRedis.del).toHaveBeenCalledWith(key);
    });

    it('should handle deletion of non-existent keys', async () => {
      const key = 'nonexistent:key';
      
      mockRedis.del.mockResolvedValue(0);

      await cacheService.delete(key);

      expect(mockRedis.del).toHaveBeenCalledWith(key);
    });
  });
});