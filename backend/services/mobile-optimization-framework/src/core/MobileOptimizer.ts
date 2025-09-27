/**
 * Mobile API Optimizer - Core Orchestrator
 *
 * Central coordinator for mobile API optimization features including:
 * - Multi-layer caching strategy
 * - Network-aware optimization
 * - Connection management and pooling
 * - Payload compression and optimization
 * - Mobile-specific API features
 * - Performance monitoring and analytics
 */

import { EventEmitter } from 'events';
import { mobileOptimizationConfig, MobileOptimizationConfigManager } from './MobileOptimizationConfig';
import { Logger } from '../utils/Logger';
import { PerformanceMonitor } from '../monitoring/PerformanceMonitor';
import { MultiLayerCache } from '../caching/MultiLayerCache';
import { NetworkAwarenessManager } from '../network/NetworkAwarenessManager';
import { PayloadOptimizer } from '../payload/PayloadOptimizer';
import { DeviceAdaptationManager } from '../mobile/DeviceAdaptationManager';
import { BackgroundSyncManager } from '../mobile/BackgroundSyncManager';
import { MetricsCollector } from '../monitoring/MetricsCollector';
import { MobileOptimizationError } from '../types/mobile.types';

export interface MobileOptimizationContext {
  userId?: string;
  sessionId?: string;
  deviceId?: string;
  deviceType?: 'ios' | 'android' | 'web';
  networkType?: 'wifi' | 'cellular' | 'unknown';
  connectionQuality?: 'excellent' | 'good' | 'poor' | 'offline';
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  batteryLevel?: number;
  isBackground?: boolean;
  timestamp: number;
}

export interface MobileOptimizationResult {
  optimized: boolean;
  optimizations: string[];
  metrics: {
    originalSize: number;
    optimizedSize: number;
    compressionRatio: number;
    estimatedTimeSaved: number;
    cacheHit: boolean;
    cacheLayer?: string;
  };
  warnings: string[];
  errors: string[];
}

/**
 * Mobile API Optimizer - Main orchestrator class
 */
export class MobileOptimizer extends EventEmitter {
  private static instance: MobileOptimizer;
  private configManager: MobileOptimizationConfigManager;
  private logger: Logger;
  private performanceMonitor: PerformanceMonitor;
  private metricsCollector: MetricsCollector;
  private cache: MultiLayerCache;
  private networkManager: NetworkAwarenessManager;
  private payloadOptimizer: PayloadOptimizer;
  private deviceManager: DeviceAdaptationManager;
  private backgroundSyncManager: BackgroundSyncManager;
  private isInitialized = false;

  private constructor() {
    super();
    this.configManager = MobileOptimizationConfigManager.getInstance();
    this.logger = new Logger('MobileOptimizer');
    this.performanceMonitor = new PerformanceMonitor();
    this.metricsCollector = new MetricsCollector();
    this.cache = new MultiLayerCache();
    this.networkManager = new NetworkAwarenessManager();
    this.payloadOptimizer = new PayloadOptimizer();
    this.deviceManager = new DeviceAdaptationManager();
    this.backgroundSyncManager = new BackgroundSyncManager();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): MobileOptimizer {
    if (!MobileOptimizer.instance) {
      MobileOptimizer.instance = new MobileOptimizer();
    }
    return MobileOptimizer.instance;
  }

  /**
   * Initialize the mobile optimizer with all subsystems
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('MobileOptimizer already initialized');
      return;
    }

    try {
      this.logger.info('Initializing Mobile API Optimization Framework...');

      // Initialize all subsystems
      await Promise.all([
        this.cache.initialize(),
        this.networkManager.initialize(),
        this.deviceManager.initialize(),
        this.backgroundSyncManager.initialize(),
        this.performanceMonitor.initialize(),
        this.metricsCollector.initialize(),
      ]);

      this.setupEventListeners();
      this.isInitialized = true;

      this.logger.info('Mobile API Optimization Framework initialized successfully');

      // Emit initialization event
      this.emit('initialized');

    } catch (error) {
      this.logger.error('Failed to initialize MobileOptimizer:', error);
      throw new MobileOptimizationError(
        'MOBILE_OPTIMIZER_INITIALIZATION_FAILED',
        'Failed to initialize mobile optimization framework',
        { originalError: error }
      );
    }
  }

  /**
   * Optimize API request/response for mobile consumption
   */
  public async optimizeRequest<T = any>(
    endpoint: string,
    method: string,
    data?: T,
    context?: Partial<MobileOptimizationContext>
  ): Promise<{
    optimizedData?: T;
    optimizations: string[];
    metadata: Record<string, any>;
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const fullContext: MobileOptimizationContext = {
      timestamp: startTime,
      ...context,
    };

    try {
      this.logger.debug(`Optimizing request: ${method} ${endpoint}`, { context: fullContext });

      const optimizations: string[] = [];
      const metadata: Record<string, any> = {};

      // 1. Network-aware optimization
      const networkOptimization = await this.networkManager.optimizeForNetwork(fullContext);
      if (networkOptimization.applied) {
        optimizations.push(...networkOptimization.optimizations);
        Object.assign(metadata, networkOptimization.metadata);
      }

      // 2. Device-specific optimization
      const deviceOptimization = await this.deviceManager.optimizeForDevice(data, fullContext);
      if (deviceOptimization.applied) {
        optimizations.push(...deviceOptimization.optimizations);
        Object.assign(metadata, deviceOptimization.metadata);
      }

      // 3. Payload optimization
      let optimizedData = data;
      if (data && this.configManager.isFeatureEnabled('compression.enabled')) {
        const payloadOptimization = await this.payloadOptimizer.optimize(data, fullContext);
        if (payloadOptimization.optimized) {
          optimizedData = payloadOptimization.data;
          optimizations.push(...payloadOptimization.optimizations);
          Object.assign(metadata, payloadOptimization.metadata);
        }
      }

      // 4. Caching optimization
      const cacheResult = await this.checkCache(endpoint, method, data, fullContext);
      if (cacheResult.hit) {
        optimizations.push('cache-hit');
        metadata.cacheLayer = cacheResult.layer;
        metadata.cacheKey = cacheResult.key;
      }

      // 5. Background sync optimization
      if (this.shouldUseBackgroundSync(fullContext)) {
        await this.backgroundSyncManager.queueForBackground(endpoint, method, optimizedData, fullContext);
        optimizations.push('background-sync-queued');
      }

      // Record metrics
      const duration = Date.now() - startTime;
      await this.metricsCollector.recordOptimization({
        endpoint,
        method,
        duration,
        optimizations: optimizations.length,
        dataSize: JSON.stringify(data || {}).length,
        optimizedSize: JSON.stringify(optimizedData || {}).length,
        context: fullContext,
      });

      this.logger.debug(`Request optimization completed in ${duration}ms`, {
        optimizations,
        metadata,
      });

      return {
        optimizedData,
        optimizations,
        metadata,
      };

    } catch (error) {
      this.logger.error('Request optimization failed:', error);

      // Record error metrics
      await this.metricsCollector.recordError({
        endpoint,
        method,
        error: error instanceof Error ? error.message : 'Unknown error',
        context: fullContext,
      });

      throw error;
    }
  }

  /**
   * Optimize API response for mobile consumption
   */
  public async optimizeResponse<T = any>(
    endpoint: string,
    method: string,
    data: T,
    context?: Partial<MobileOptimizationContext>
  ): Promise<{
    optimizedData: T;
    optimizations: string[];
    metadata: Record<string, any>;
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const fullContext: MobileOptimizationContext = {
      timestamp: startTime,
      ...context,
    };

    try {
      this.logger.debug(`Optimizing response: ${method} ${endpoint}`, { context: fullContext });

      const optimizations: string[] = [];
      const metadata: Record<string, any> = {};

      // 1. Cache the response
      if (this.configManager.isFeatureEnabled('caching.enabled')) {
        await this.cache.set(endpoint, method, data, fullContext);
        optimizations.push('response-cached');
      }

      // 2. Network-aware response optimization
      const networkOptimization = await this.networkManager.optimizeResponse(data, fullContext);
      if (networkOptimization.applied) {
        optimizations.push(...networkOptimization.optimizations);
        Object.assign(metadata, networkOptimization.metadata);
      }

      // 3. Device-specific response optimization
      const deviceOptimization = await this.deviceManager.optimizeResponse(data, fullContext);
      if (deviceOptimization.applied) {
        optimizations.push(...deviceOptimization.optimizations);
        Object.assign(metadata, deviceOptimization.metadata);
      }

      // 4. Payload optimization
      let optimizedData = data;
      if (this.configManager.isFeatureEnabled('compression.enabled')) {
        const payloadOptimization = await this.payloadOptimizer.optimize(data, fullContext);
        if (payloadOptimization.optimized) {
          optimizedData = payloadOptimization.data;
          optimizations.push(...payloadOptimization.optimizations);
          Object.assign(metadata, payloadOptimization.metadata);
        }
      }

      // Record metrics
      const duration = Date.now() - startTime;
      await this.metricsCollector.recordOptimization({
        endpoint,
        method,
        duration,
        optimizations: optimizations.length,
        dataSize: JSON.stringify(data || {}).length,
        optimizedSize: JSON.stringify(optimizedData || {}).length,
        context: fullContext,
      });

      this.logger.debug(`Response optimization completed in ${duration}ms`, {
        optimizations,
        metadata,
      });

      return {
        optimizedData,
        optimizations,
        metadata,
      };

    } catch (error) {
      this.logger.error('Response optimization failed:', error);

      await this.metricsCollector.recordError({
        endpoint,
        method,
        error: error instanceof Error ? error.message : 'Unknown error',
        context: fullContext,
      });

      throw error;
    }
  }

  /**
   * Check if request can be served from cache
   */
  private async checkCache(
    endpoint: string,
    method: string,
    data: any,
    context: MobileOptimizationContext
  ): Promise<{ hit: boolean; data?: any; layer?: string; key?: string }> {
    try {
      const cacheKey = this.generateCacheKey(endpoint, method, data);
      const cached = await this.cache.get(cacheKey, context);

      if (cached) {
        this.logger.debug('Cache hit', { endpoint, method, layer: cached.layer });
        return {
          hit: true,
          data: cached.data,
          layer: cached.layer,
          key: cacheKey,
        };
      }

      return { hit: false };
    } catch (error) {
      this.logger.warn('Cache check failed:', error);
      return { hit: false };
    }
  }

  /**
   * Generate cache key for request
   */
  private generateCacheKey(endpoint: string, method: string, data: any): string {
    const dataStr = data ? JSON.stringify(data) : '';
    return `mobile:${method}:${endpoint}:${Buffer.from(dataStr).toString('base64').slice(0, 32)}`;
  }

  /**
   * Check if request should use background sync
   */
  private shouldUseBackgroundSync(context: MobileOptimizationContext): boolean {
    return (
      this.configManager.isFeatureEnabled('mobile.backgroundSyncEnabled') &&
      (context.isBackground === true ||
       context.networkType === 'cellular' ||
       context.connectionQuality === 'poor')
    );
  }

  /**
   * Setup event listeners for subsystem coordination
   */
  private setupEventListeners(): void {
    // Network status changes
    this.networkManager.on('networkChange', (networkInfo) => {
      this.emit('networkChange', networkInfo);
    });

    // Cache events
    this.cache.on('cacheHit', (event) => {
      this.emit('cacheHit', event);
    });

    this.cache.on('cacheMiss', (event) => {
      this.emit('cacheMiss', event);
    });

    // Performance events
    this.performanceMonitor.on('performanceAlert', (alert) => {
      this.emit('performanceAlert', alert);
    });

    // Background sync events
    this.backgroundSyncManager.on('syncCompleted', (event) => {
      this.emit('syncCompleted', event);
    });

    this.backgroundSyncManager.on('syncFailed', (event) => {
      this.emit('syncFailed', event);
    });
  }

  /**
   * Get current optimization statistics
   */
  public async getStatistics(): Promise<{
    uptime: number;
    totalOptimizations: number;
    cacheHitRate: number;
    averageOptimizationTime: number;
    networkConditions: any;
    deviceMetrics: any;
  }> {
    const metrics = await this.metricsCollector.getAggregatedMetrics();

    return {
      uptime: Date.now() - (this.performanceMonitor as any).startTime,
      totalOptimizations: metrics.totalOptimizations,
      cacheHitRate: metrics.cacheHitRate,
      averageOptimizationTime: metrics.averageOptimizationTime,
      networkConditions: this.networkManager.getCurrentNetworkConditions(),
      deviceMetrics: this.deviceManager.getDeviceMetrics(),
    };
  }

  /**
   * Health check for all subsystems
   */
  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    subsystems: Record<string, boolean>;
    issues: string[];
  }> {
    const issues: string[] = [];
    const subsystems: Record<string, boolean> = {};

    // Check each subsystem
    const checks = [
      { name: 'cache', check: () => this.cache.healthCheck() },
      { name: 'network', check: () => this.networkManager.healthCheck() },
      { name: 'performance', check: () => this.performanceMonitor.healthCheck() },
      { name: 'backgroundSync', check: () => this.backgroundSyncManager.healthCheck() },
    ];

    for (const { name, check } of checks) {
      try {
        subsystems[name] = await check();
        if (!subsystems[name]) {
          issues.push(`${name} subsystem is unhealthy`);
        }
      } catch (error) {
        subsystems[name] = false;
        issues.push(`${name} subsystem check failed: ${error}`);
      }
    }

    const healthySubsystems = Object.values(subsystems).filter(Boolean).length;
    const status = healthySubsystems === checks.length
      ? 'healthy'
      : healthySubsystems > 0
        ? 'degraded'
        : 'unhealthy';

    return {
      status,
      subsystems,
      issues,
    };
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down MobileOptimizer...');

    try {
      await Promise.all([
        this.cache.shutdown(),
        this.networkManager.shutdown(),
        this.backgroundSyncManager.shutdown(),
        this.performanceMonitor.shutdown(),
        this.metricsCollector.shutdown(),
      ]);

      this.removeAllListeners();
      this.isInitialized = false;

      this.logger.info('MobileOptimizer shutdown completed');
    } catch (error) {
      this.logger.error('Error during MobileOptimizer shutdown:', error);
      throw error;
    }
  }

  /**
   * Get configuration manager
   */
  public getConfig(): MobileOptimizationConfigManager {
    return this.configManager;
  }

  /**
   * Get performance monitor
   */
  public getPerformanceMonitor(): PerformanceMonitor {
    return this.performanceMonitor;
  }

  /**
   * Get metrics collector
   */
  public getMetricsCollector(): MetricsCollector {
    return this.metricsCollector;
  }

  /**
   * Get cache instance
   */
  public getCache(): MultiLayerCache {
    return this.cache;
  }

  /**
   * Get network manager
   */
  public getNetworkManager(): NetworkAwarenessManager {
    return this.networkManager;
  }

  /**
   * Get device manager
   */
  public getDeviceManager(): DeviceAdaptationManager {
    return this.deviceManager;
  }

  /**
   * Get background sync manager
   */
  public getBackgroundSyncManager(): BackgroundSyncManager {
    return this.backgroundSyncManager;
  }
}

// Export singleton instance
export const mobileOptimizer = MobileOptimizer.getInstance();