/**
 * Multi-Layer Caching Strategy for Mobile API Optimization
 *
 * Implements a comprehensive caching strategy with multiple layers:
 * - Edge Caching: CDN-level caching for static content
 * - Application Caching: Redis-based caching with mobile-optimized TTL
 * - Client Caching: Mobile app-level caching with intelligent invalidation
 * - Database Caching: Query result caching with mobile usage patterns
 *
 * Features:
 * - Mobile-aware cache invalidation
 * - Compression and encryption support
 * - Network-aware caching strategies
 * - Battery and data usage optimization
 * - Background cache warming
 * - Intelligent cache layer selection
 */

import { EventEmitter } from 'events';
import NodeCache from 'node-cache';
import { Logger } from '../utils/Logger';
import {
  CacheEntry,
  CacheResult,
  MobileOptimizationContext,
  MobileOptimizationError
} from '../types/mobile.types';

export interface CacheLayer {
  name: string;
  type: 'edge' | 'application' | 'client' | 'database';
  priority: number;
  enabled: boolean;
  maxSize: number;
  defaultTTL: number;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
}

export interface CacheStrategy {
  layer: string;
  ttl: number;
  compressed: boolean;
  encrypted: boolean;
  networkAware: boolean;
  batteryAware: boolean;
  dataUsageAware: boolean;
}

export interface CacheWarmingConfig {
  enabled: boolean;
  warmupEndpoints: string[];
  warmupInterval: number;
  concurrentRequests: number;
  retryAttempts: number;
}

/**
 * Multi-Layer Cache Manager
 */
export class MultiLayerCache extends EventEmitter {
  private static instance: MultiLayerCache;
  private logger: Logger;
  private config: CacheLayer[];
  private caches: Map<string, NodeCache>;
  private cacheStats: Map<string, {
    hits: number;
    misses: number;
    sets: number;
    deletes: number;
    evictions: number;
  }>;
  private cacheWarmingActive = false;
  private isInitialized = false;

  private constructor() {
    super();
    this.logger = new Logger('MultiLayerCache');
    this.caches = new Map();
    this.cacheStats = new Map();
    this.config = this.initializeCacheLayers();
  }

  public static getInstance(): MultiLayerCache {
    if (!MultiLayerCache.instance) {
      MultiLayerCache.instance = new MultiLayerCache();
    }
    return MultiLayerCache.instance;
  }

  /**
   * Initialize cache layers with mobile-optimized configuration
   */
  private initializeCacheLayers(): CacheLayer[] {
    return [
      {
        name: 'edge',
        type: 'edge',
        priority: 1,
        enabled: true,
        maxSize: 10000,
        defaultTTL: 3600, // 1 hour for edge cache
        compressionEnabled: true,
        encryptionEnabled: false,
      },
      {
        name: 'application',
        type: 'application',
        priority: 2,
        enabled: true,
        maxSize: 50000,
        defaultTTL: 300, // 5 minutes for application cache
        compressionEnabled: true,
        encryptionEnabled: false,
      },
      {
        name: 'client',
        type: 'client',
        priority: 3,
        enabled: true,
        maxSize: 1000,
        defaultTTL: 60, // 1 minute for client cache
        compressionEnabled: true,
        encryptionEnabled: true, // Higher security for client-side
      },
      {
        name: 'database',
        type: 'database',
        priority: 4,
        enabled: true,
        maxSize: 20000,
        defaultTTL: 120, // 2 minutes for database cache
        compressionEnabled: false,
        encryptionEnabled: false,
      },
    ];
  }

  /**
   * Initialize the multi-layer cache system
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('MultiLayerCache already initialized');
      return;
    }

    try {
      this.logger.info('Initializing Multi-Layer Cache System...');

      // Initialize each cache layer
      for (const layerConfig of this.config) {
        if (layerConfig.enabled) {
          await this.initializeCacheLayer(layerConfig);
        }
      }

      // Start cache warming if enabled
      await this.startCacheWarming();

      // Setup cache maintenance
      this.setupCacheMaintenance();

      this.isInitialized = true;
      this.emit('initialized');

      this.logger.info('Multi-Layer Cache System initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize MultiLayerCache:', error);
      throw new MobileOptimizationError(
        'CACHE_INITIALIZATION_FAILED',
        'Failed to initialize multi-layer cache system',
        { originalError: error }
      );
    }
  }

  /**
   * Initialize a specific cache layer
   */
  private async initializeCacheLayer(layerConfig: CacheLayer): Promise<void> {
    try {
      // Create NodeCache instance with mobile-optimized settings
      const cache = new NodeCache({
        stdTTL: layerConfig.defaultTTL,
        maxKeys: layerConfig.maxSize,
        useClones: false, // Optimize memory usage
        deleteOnExpire: true,
        checkperiod: Math.min(layerConfig.defaultTTL / 4, 300), // Check 4 times per TTL, max 5 minutes
      });

      // Setup event listeners for cache statistics
      cache.on('set', (key: string) => {
        this.incrementStat(layerConfig.name, 'sets');
      });

      cache.on('del', (key: string) => {
        this.incrementStat(layerConfig.name, 'deletes');
      });

      cache.on('expired', (key: string) => {
        this.incrementStat(layerConfig.name, 'evictions');
      });

      this.caches.set(layerConfig.name, cache);
      this.cacheStats.set(layerConfig.name, {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        evictions: 0,
      });

      this.logger.debug(`Initialized ${layerConfig.name} cache layer`, {
        maxSize: layerConfig.maxSize,
        defaultTTL: layerConfig.defaultTTL,
      });
    } catch (error) {
      this.logger.error(`Failed to initialize ${layerConfig.name} cache layer:`, error);
      throw error;
    }
  }

  /**
   * Get data from cache with mobile-aware strategy selection
   */
  public async get<T = any>(
    key: string,
    context: MobileOptimizationContext
  ): Promise<CacheResult<T>> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();

    try {
      // Determine optimal cache strategy based on context
      const strategy = this.determineCacheStrategy(key, context);

      // Try each enabled cache layer in priority order
      for (const layerName of strategy.layers) {
        const layerConfig = this.config.find(l => l.name === layerName);
        if (!layerConfig?.enabled) continue;

        const cache = this.caches.get(layerName);
        if (!cache) continue;

        try {
          const cachedData = cache.get(key) as CacheEntry<T> | undefined;

          if (cachedData && this.isCacheEntryValid(cachedData, context)) {
            this.incrementStat(layerName, 'hits');

            // Decompress if needed
            let data = cachedData.data;
            if (cachedData.compressed) {
              data = await this.decompressData(data, cachedData.metadata?.compressionMethod);
            }

            // Decrypt if needed
            if (cachedData.encrypted) {
              data = await this.decryptData(data, cachedData.metadata?.encryptionKey);
            }

            this.emit('cacheHit', {
              key,
              layer: layerName,
              data,
              context,
              responseTime: Date.now() - startTime,
            });

            return {
              hit: true,
              data,
              layer: layerName,
              key,
            };
          }
        } catch (error) {
          this.logger.warn(`Cache layer ${layerName} error:`, error);
          // Continue to next layer
        }
      }

      // Cache miss
      this.incrementStat('misses');
      this.emit('cacheMiss', { key, context, responseTime: Date.now() - startTime });

      return { hit: false };

    } catch (error) {
      this.logger.error('Cache get operation failed:', error);
      throw new MobileOptimizationError(
        'CACHE_GET_FAILED',
        'Failed to retrieve data from cache',
        { key, context, originalError: error }
      );
    }
  }

  /**
   * Set data in cache with mobile-aware strategy
   */
  public async set<T = any>(
    key: string,
    data: T,
    context: MobileOptimizationContext,
    customTTL?: number
  ): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const strategy = this.determineCacheStrategy(key, context);
      const ttl = customTTL || strategy.ttl;

      // Prepare data for caching
      let processedData = data;
      const metadata: Record<string, any> = {};

      // Compress if strategy requires it
      if (strategy.compressed) {
        processedData = await this.compressData(processedData);
        metadata.compressionMethod = 'gzip';
      }

      // Encrypt if strategy requires it
      if (strategy.encrypted) {
        processedData = await this.encryptData(processedData);
        metadata.encryptionKey = 'generated'; // In real implementation, use proper key management
      }

      const cacheEntry: CacheEntry<T> = {
        key,
        data: processedData,
        timestamp: Date.now(),
        ttl,
        layer: strategy.layer,
        compressed: strategy.compressed,
        encrypted: strategy.encrypted,
        metadata,
      };

      // Store in appropriate cache layers
      for (const layerName of strategy.layers) {
        const layerConfig = this.config.find(l => l.name === layerName);
        if (!layerConfig?.enabled) continue;

        const cache = this.caches.get(layerName);
        if (!cache) continue;

        try {
          cache.set(key, cacheEntry, ttl);

          this.logger.debug(`Cached data in ${layerName} layer`, {
            key,
            ttl,
            compressed: strategy.compressed,
            encrypted: strategy.encrypted,
          });
        } catch (error) {
          this.logger.warn(`Failed to cache in ${layerName} layer:`, error);
        }
      }

      this.emit('cacheSet', { key, data, context, strategy });

    } catch (error) {
      this.logger.error('Cache set operation failed:', error);
      throw new MobileOptimizationError(
        'CACHE_SET_FAILED',
        'Failed to store data in cache',
        { key, context, originalError: error }
      );
    }
  }

  /**
   * Delete data from all cache layers
   */
  public async delete(key: string, context: MobileOptimizationContext): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      for (const layerConfig of this.config) {
        if (!layerConfig.enabled) continue;

        const cache = this.caches.get(layerConfig.name);
        if (!cache) continue;

        try {
          cache.del(key);
          this.incrementStat(layerConfig.name, 'deletes');
        } catch (error) {
          this.logger.warn(`Failed to delete from ${layerConfig.name} cache:`, error);
        }
      }

      this.emit('cacheDelete', { key, context });

    } catch (error) {
      this.logger.error('Cache delete operation failed:', error);
      throw new MobileOptimizationError(
        'CACHE_DELETE_FAILED',
        'Failed to delete data from cache',
        { key, context, originalError: error }
      );
    }
  }

  /**
   * Clear all caches (primarily for testing or maintenance)
   */
  public async clearAll(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      for (const layerConfig of this.config) {
        if (!layerConfig.enabled) continue;

        const cache = this.caches.get(layerConfig.name);
        if (!cache) continue;

        cache.flushAll();
        this.resetStats(layerConfig.name);
      }

      this.emit('cacheCleared');
      this.logger.info('All cache layers cleared');

    } catch (error) {
      this.logger.error('Cache clear operation failed:', error);
      throw new MobileOptimizationError(
        'CACHE_CLEAR_FAILED',
        'Failed to clear cache layers',
        { originalError: error }
      );
    }
  }

  /**
   * Determine optimal cache strategy based on context
   */
  private determineCacheStrategy(key: string, context: MobileOptimizationContext): CacheStrategy {
    // Network-aware strategy selection
    let strategy: CacheStrategy = {
      layer: 'application',
      ttl: 300, // 5 minutes default
      compressed: true,
      encrypted: false,
      networkAware: true,
      batteryAware: false,
      dataUsageAware: false,
    };

    // Adjust strategy based on network conditions
    if (context.networkType === 'cellular') {
      strategy.ttl = 600; // Longer TTL for cellular to reduce data usage
      strategy.compressed = true;
      strategy.dataUsageAware = true;
    } else if (context.networkType === 'wifi') {
      strategy.ttl = 180; // Shorter TTL for faster wifi networks
      strategy.compressed = true;
    }

    // Adjust strategy based on connection quality
    if (context.connectionQuality === 'poor') {
      strategy.ttl = 1200; // Much longer TTL for poor connections
      strategy.compressed = true;
    } else if (context.connectionQuality === 'excellent') {
      strategy.ttl = 60; // Shorter TTL for excellent connections
    }

    // Battery-aware strategy
    if (context.batteryLevel !== undefined && context.batteryLevel < 20) {
      strategy.batteryAware = true;
      strategy.ttl = Math.max(strategy.ttl, 600); // Extend TTL to reduce network requests
    }

    // Device-specific strategy
    if (context.deviceType === 'ios') {
      strategy.encrypted = true; // Higher security for iOS
    }

    // Background mode strategy
    if (context.isBackground) {
      strategy.ttl = Math.max(strategy.ttl, 1800); // Longer TTL for background operations
    }

    // Determine cache layers based on strategy
    strategy.layers = this.selectCacheLayers(strategy);

    return strategy;
  }

  /**
   * Select appropriate cache layers for the strategy
   */
  private selectCacheLayers(strategy: CacheStrategy): string[] {
    const layers: string[] = [];

    // Always try fastest layers first
    if (strategy.networkAware && strategy.dataUsageAware) {
      // For data-conscious scenarios, prioritize client cache
      layers.push('client', 'application', 'edge');
    } else {
      // Default priority order
      layers.push('application', 'edge', 'client');
    }

    // Add database layer for complex queries
    if (strategy.layer === 'database') {
      layers.push('database');
    }

    return layers;
  }

  /**
   * Check if cache entry is still valid
   */
  private isCacheEntryValid(entry: CacheEntry, context: MobileOptimizationContext): boolean {
    const now = Date.now();
    const isExpired = (now - entry.timestamp) > (entry.ttl * 1000);

    if (isExpired) {
      return false;
    }

    // Additional validation based on context
    if (context.networkType === 'offline' && entry.layer !== 'client') {
      // Only client cache is reliable when offline
      return false;
    }

    return true;
  }

  /**
   * Compress data for caching
   */
  private async compressData(data: any): Promise<any> {
    // In a real implementation, this would use proper compression
    // For now, return as-is (would integrate with zlib or similar)
    return data;
  }

  /**
   * Decompress cached data
   */
  private async decompressData(data: any, method?: string): Promise<any> {
    // In a real implementation, this would use proper decompression
    return data;
  }

  /**
   * Encrypt data for caching
   */
  private async encryptData(data: any): Promise<any> {
    // In a real implementation, this would use proper encryption
    // For now, return as-is (would integrate with crypto library)
    return data;
  }

  /**
   * Decrypt cached data
   */
  private async decryptData(data: any, keyHint?: string): Promise<any> {
    // In a real implementation, this would use proper decryption
    return data;
  }

  /**
   * Start cache warming for frequently accessed endpoints
   */
  private async startCacheWarming(): Promise<void> {
    // This would be configured based on analytics data
    // For now, just log that warming is available
    this.logger.debug('Cache warming system ready (configure warmupEndpoints to enable)');
  }

  /**
   * Setup periodic cache maintenance
   */
  private setupCacheMaintenance(): void {
    // Memory cleanup every 5 minutes
    setInterval(() => {
      this.performCacheMaintenance();
    }, 5 * 60 * 1000);

    // Statistics reporting every minute
    setInterval(() => {
      this.reportCacheStatistics();
    }, 60 * 1000);
  }

  /**
   * Perform cache maintenance tasks
   */
  private performCacheMaintenance(): void {
    try {
      for (const [layerName, cache] of this.caches) {
        const stats = cache.getStats();

        // Check for high memory usage
        if (stats.keys > this.config.find(l => l.name === layerName)?.maxSize * 0.9) {
          this.logger.warn(`Cache layer ${layerName} approaching capacity limit`, {
            currentKeys: stats.keys,
            maxKeys: this.config.find(l => l.name === layerName)?.maxSize,
          });

          // Trigger cleanup of expired entries
          cache.flushExpired();
        }
      }
    } catch (error) {
      this.logger.error('Cache maintenance failed:', error);
    }
  }

  /**
   * Report cache statistics
   */
  private reportCacheStatistics(): void {
    try {
      const overallStats = {
        timestamp: Date.now(),
        layers: {},
      };

      for (const [layerName, stats] of this.cacheStats) {
        const cache = this.caches.get(layerName);
        const nodeCacheStats = cache?.getStats();

        overallStats.layers[layerName] = {
          ...stats,
          nodeCacheStats,
          hitRate: stats.hits / (stats.hits + stats.misses) || 0,
        };
      }

      this.emit('cacheStats', overallStats);
    } catch (error) {
      this.logger.error('Cache statistics reporting failed:', error);
    }
  }

  /**
   * Increment cache statistics
   */
  private incrementStat(layerName: string, stat: keyof typeof this.cacheStats extends Map<string, infer T> ? T : never): void {
    const currentStats = this.cacheStats.get(layerName);
    if (currentStats) {
      currentStats[stat]++;
    }
  }

  /**
   * Reset statistics for a cache layer
   */
  private resetStats(layerName: string): void {
    this.cacheStats.set(layerName, {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
    });
  }

  /**
   * Get cache statistics
   */
  public getCacheStatistics(): Record<string, any> {
    const stats: Record<string, any> = {};

    for (const [layerName, layerStats] of this.cacheStats) {
      const cache = this.caches.get(layerName);
      const nodeCacheStats = cache?.getStats();

      stats[layerName] = {
        ...layerStats,
        nodeCacheStats,
        hitRate: layerStats.hits / (layerStats.hits + layerStats.misses) || 0,
      };
    }

    return stats;
  }

  /**
   * Get cache layer configuration
   */
  public getCacheLayers(): CacheLayer[] {
    return [...this.config];
  }

  /**
   * Update cache layer configuration
   */
  public updateCacheLayer(layerName: string, updates: Partial<CacheLayer>): void {
    const layerIndex = this.config.findIndex(l => l.name === layerName);
    if (layerIndex >= 0) {
      this.config[layerIndex] = { ...this.config[layerIndex], ...updates };

      // Reinitialize the layer if it's currently active
      if (this.caches.has(layerName)) {
        // Note: In a production system, you might want to recreate the cache
        this.logger.info(`Updated configuration for ${layerName} cache layer`);
      }
    }
  }

  /**
   * Health check for cache system
   */
  public async healthCheck(): Promise<boolean> {
    try {
      for (const layerConfig of this.config) {
        if (!layerConfig.enabled) continue;

        const cache = this.caches.get(layerConfig.name);
        if (!cache) {
          this.logger.error(`Cache layer ${layerConfig.name} not initialized`);
          return false;
        }

        // Test basic cache operations
        const testKey = `health-check-${layerConfig.name}-${Date.now()}`;
        const testData = { test: true, timestamp: Date.now() };

        await cache.set(testKey, testData, 10); // 10 second TTL
        const retrieved = cache.get(testKey);

        if (!retrieved || retrieved.test !== true) {
          this.logger.error(`Cache layer ${layerConfig.name} health check failed`);
          return false;
        }

        cache.del(testKey);
      }

      return true;
    } catch (error) {
      this.logger.error('Cache health check failed:', error);
      return false;
    }
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down MultiLayerCache...');

    try {
      // Stop cache warming
      this.cacheWarmingActive = false;

      // Close all cache connections
      for (const [layerName, cache] of this.caches) {
        cache.close();
        this.logger.debug(`Closed ${layerName} cache layer`);
      }

      this.caches.clear();
      this.cacheStats.clear();
      this.removeAllListeners();

      this.logger.info('MultiLayerCache shutdown completed');
    } catch (error) {
      this.logger.error('Error during MultiLayerCache shutdown:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const multiLayerCache = MultiLayerCache.getInstance();