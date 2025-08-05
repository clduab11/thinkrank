import Redis from 'ioredis';
import { logger } from '@thinkrank/shared';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;
  cluster?: {
    enabled: boolean;
    nodes: Array<{ host: string; port: number }>;
  };
  sentinel?: {
    enabled: boolean;
    masterName: string;
    sentinels: Array<{ host: string; port: number }>;
  };
}

export class RedisManager {
  private client: Redis;
  private pubClient: Redis;
  private subClient: Redis;
  private clusterClient?: Redis.Cluster;
  private config: RedisConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): RedisConfig {
    return {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      keyPrefix: 'thinkrank:realtime:',
      cluster: {
        enabled: process.env.REDIS_CLUSTER_ENABLED === 'true',
        nodes: process.env.REDIS_CLUSTER_NODES
          ? JSON.parse(process.env.REDIS_CLUSTER_NODES)
          : [{ host: 'localhost', port: 6379 }]
      },
      sentinel: {
        enabled: process.env.REDIS_SENTINEL_ENABLED === 'true',
        masterName: process.env.REDIS_SENTINEL_MASTER_NAME || 'mymaster',
        sentinels: process.env.REDIS_SENTINEL_NODES
          ? JSON.parse(process.env.REDIS_SENTINEL_NODES)
          : [{ host: 'localhost', port: 26379 }]
      }
    };
  }

  async connect(): Promise<void> {
    try {
      if (this.config.cluster.enabled) {
        // Redis Cluster setup
        this.clusterClient = new Redis.Cluster(this.config.cluster.nodes, {
          redisOptions: {
            password: this.config.password,
            keyPrefix: this.config.keyPrefix
          },
          enableOfflineQueue: false,
          retryDelayOnFailover: 100,
          maxRetriesPerRequest: 3
        });

        this.client = this.clusterClient;
        this.pubClient = new Redis.Cluster(this.config.cluster.nodes);
        this.subClient = new Redis.Cluster(this.config.cluster.nodes);

      } else if (this.config.sentinel.enabled) {
        // Redis Sentinel setup
        const sentinelConfig = {
          sentinels: this.config.sentinel.sentinels,
          name: this.config.sentinel.masterName,
          password: this.config.password,
          db: this.config.db,
          keyPrefix: this.config.keyPrefix
        };

        this.client = new Redis(sentinelConfig);
        this.pubClient = new Redis(sentinelConfig);
        this.subClient = new Redis(sentinelConfig);

      } else {
        // Single Redis instance
        const redisConfig = {
          host: this.config.host,
          port: this.config.port,
          password: this.config.password,
          db: this.config.db,
          keyPrefix: this.config.keyPrefix,
          retryDelayOnFailover: 100,
          maxRetriesPerRequest: 3,
          lazyConnect: true
        };

        this.client = new Redis(redisConfig);
        this.pubClient = new Redis(redisConfig);
        this.subClient = new Redis(redisConfig);
      }

      // Connect clients
      await Promise.all([
        this.client.connect?.() || Promise.resolve(),
        this.pubClient.connect?.() || Promise.resolve(),
        this.subClient.connect?.() || Promise.resolve()
      ]);

      // Setup error handlers
      this.setupErrorHandlers();

      // Test connections
      await this.client.ping();
      await this.pubClient.ping();
      await this.subClient.ping();

      logger.info('Redis connections established successfully');

      // Setup health monitoring
      this.setupHealthMonitoring();

    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  private setupErrorHandlers(): void {
    const clients = [this.client, this.pubClient, this.subClient];

    clients.forEach((client, index) => {
      const clientName = ['main', 'pub', 'sub'][index];

      client.on('error', (error) => {
        logger.error(`Redis ${clientName} client error:`, error);
      });

      client.on('connect', () => {
        logger.info(`Redis ${clientName} client connected`);
      });

      client.on('reconnecting', () => {
        logger.warn(`Redis ${clientName} client reconnecting`);
      });

      client.on('end', () => {
        logger.warn(`Redis ${clientName} client connection ended`);
      });
    });
  }

  private setupHealthMonitoring(): void {
    // Monitor Redis health every 30 seconds
    setInterval(async () => {
      try {
        await this.client.ping();
      } catch (error) {
        logger.error('Redis health check failed:', error);
      }
    }, 30000);
  }

  // Cache operations
  async set(key: string, value: any, ttl?: number): Promise<void> {
    const serializedValue = JSON.stringify(value);
    if (ttl) {
      await this.client.setex(key, ttl, serializedValue);
    } else {
      await this.client.set(key, serializedValue);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    return value ? JSON.parse(value) : null;
  }

  async del(key: string): Promise<number> {
    return await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1;
  }

  // Hash operations
  async hset(key: string, field: string, value: any): Promise<void> {
    await this.client.hset(key, field, JSON.stringify(value));
  }

  async hget<T>(key: string, field: string): Promise<T | null> {
    const value = await this.client.hget(key, field);
    return value ? JSON.parse(value) : null;
  }

  async hgetall<T>(key: string): Promise<Record<string, T>> {
    const values = await this.client.hgetall(key);
    const result: Record<string, T> = {};
    
    for (const [field, value] of Object.entries(values)) {
      result[field] = JSON.parse(value);
    }
    
    return result;
  }

  async hdel(key: string, field: string): Promise<number> {
    return await this.client.hdel(key, field);
  }

  // Set operations
  async sadd(key: string, ...members: string[]): Promise<number> {
    return await this.client.sadd(key, ...members);
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    return await this.client.srem(key, ...members);
  }

  async smembers(key: string): Promise<string[]> {
    return await this.client.smembers(key);
  }

  async sismember(key: string, member: string): Promise<boolean> {
    return (await this.client.sismember(key, member)) === 1;
  }

  // List operations
  async lpush(key: string, ...values: any[]): Promise<number> {
    const serializedValues = values.map(v => JSON.stringify(v));
    return await this.client.lpush(key, ...serializedValues);
  }

  async rpush(key: string, ...values: any[]): Promise<number> {
    const serializedValues = values.map(v => JSON.stringify(v));
    return await this.client.rpush(key, ...serializedValues);
  }

  async lpop<T>(key: string): Promise<T | null> {
    const value = await this.client.lpop(key);
    return value ? JSON.parse(value) : null;
  }

  async lrange<T>(key: string, start: number, stop: number): Promise<T[]> {
    const values = await this.client.lrange(key, start, stop);
    return values.map(v => JSON.parse(v));
  }

  // Sorted set operations
  async zadd(key: string, score: number, member: string): Promise<number> {
    return await this.client.zadd(key, score, member);
  }

  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    return await this.client.zrange(key, start, stop);
  }

  async zrangebyscore(key: string, min: number, max: number): Promise<string[]> {
    return await this.client.zrangebyscore(key, min, max);
  }

  async zrem(key: string, member: string): Promise<number> {
    return await this.client.zrem(key, member);
  }

  // Pub/Sub operations
  async publish(channel: string, message: any): Promise<number> {
    return await this.pubClient.publish(channel, JSON.stringify(message));
  }

  async subscribe(channel: string, callback: (message: any) => void): Promise<void> {
    await this.subClient.subscribe(channel);
    this.subClient.on('message', (receivedChannel, message) => {
      if (receivedChannel === channel) {
        try {
          const parsedMessage = JSON.parse(message);
          callback(parsedMessage);
        } catch (error) {
          logger.error('Error parsing pub/sub message:', error);
        }
      }
    });
  }

  // Rate limiting
  async checkRateLimit(key: string, limit: number, window: number): Promise<boolean> {
    const pipeline = this.client.pipeline();
    const now = Date.now();
    const windowStart = now - window * 1000;

    pipeline.zremrangebyscore(key, '-inf', windowStart);
    pipeline.zcard(key);
    pipeline.zadd(key, now, now);
    pipeline.expire(key, window);

    const results = await pipeline.exec();
    const currentCount = results?.[1]?.[1] as number || 0;

    return currentCount < limit;
  }

  // Cache warming
  async warmCache(patterns: string[]): Promise<void> {
    logger.info('Starting cache warming...');
    
    for (const pattern of patterns) {
      try {
        const keys = await this.client.keys(pattern);
        logger.info(`Warming ${keys.length} keys for pattern: ${pattern}`);
        
        // Pre-load frequently accessed data
        for (const key of keys) {
          await this.client.get(key);
        }
      } catch (error) {
        logger.error(`Error warming cache for pattern ${pattern}:`, error);
      }
    }
    
    logger.info('Cache warming completed');
  }

  // Cache invalidation
  async invalidatePattern(pattern: string): Promise<number> {
    const keys = await this.client.keys(pattern);
    if (keys.length === 0) return 0;
    
    return await this.client.del(...keys);
  }

  // Message storage for chat history
  async storeMessage(type: string, target: string, message: any): Promise<void> {
    const key = `messages:${type}:${target}`;
    await this.lpush(key, message);
    
    // Keep only last 1000 messages
    await this.client.ltrim(key, 0, 999);
    
    // Set expiry (30 days)
    await this.client.expire(key, 30 * 24 * 60 * 60);
  }

  async getMessageHistory(type: string, target: string, limit: number = 50): Promise<any[]> {
    const key = `messages:${type}:${target}`;
    return await this.lrange(key, 0, limit - 1);
  }

  // Connection state management
  async setConnectionState(socketId: string, state: any): Promise<void> {
    await this.hset('connections', socketId, state);
  }

  async getConnectionState(socketId: string): Promise<any> {
    return await this.hget('connections', socketId);
  }

  async removeConnectionState(socketId: string): Promise<void> {
    await this.hdel('connections', socketId);
  }

  // Graceful shutdown
  async disconnect(): Promise<void> {
    try {
      await Promise.all([
        this.client.quit(),
        this.pubClient.quit(),
        this.subClient.quit()
      ]);
      logger.info('Redis connections closed gracefully');
    } catch (error) {
      logger.error('Error during Redis disconnect:', error);
    }
  }

  // Getters for Socket.IO adapter
  getPubClient(): Redis {
    return this.pubClient;
  }

  getSubClient(): Redis {
    return this.subClient;
  }

  getMainClient(): Redis {
    return this.client;
  }
}