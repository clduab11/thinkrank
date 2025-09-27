/**
 * Mobile API Optimization Framework Configuration
 *
 * Centralized configuration management for mobile optimization features
 * with environment-specific overrides and validation.
 */

import { z } from 'zod';

export const MobileOptimizationConfigSchema = z.object({
  // Performance Targets
  performance: z.object({
    maxResponseTimeMs: z.number().default(200),
    maxBundleSizeMB: z.number().default(150),
    maxBatteryDrainPercent: z.number().default(5),
    maxDataUsageMBPerDay: z.number().default(50),
    maxConnectionTimeMs: z.number().default(2000),
  }),

  // Caching Configuration
  caching: z.object({
    enabled: z.boolean().default(true),
    edgeCacheTTL: z.number().default(3600), // 1 hour
    applicationCacheTTL: z.number().default(300), // 5 minutes
    clientCacheTTL: z.number().default(60), // 1 minute
    databaseCacheTTL: z.number().default(120), // 2 minutes
    cacheCompressionEnabled: z.boolean().default(true),
    cacheEncryptionEnabled: z.boolean().default(false),
  }),

  // Network Configuration
  network: z.object({
    connectionPoolingEnabled: z.boolean().default(true),
    maxConnectionsPerHost: z.number().default(10),
    connectionTimeoutMs: z.number().default(5000),
    requestTimeoutMs: z.number().default(30000),
    keepAliveTimeoutMs: z.number().default(60000),
    requestBatchingEnabled: z.boolean().default(true),
    maxBatchSize: z.number().default(10),
    batchDelayMs: z.number().default(50),
  }),

  // Compression Configuration
  compression: z.object({
    enabled: z.boolean().default(true),
    gzipEnabled: z.boolean().default(true),
    brotliEnabled: z.boolean().default(true),
    minCompressionSize: z.number().default(1024), // 1KB
    compressionLevel: z.number().min(1).max(9).default(6),
  }),

  // Mobile-specific Configuration
  mobile: z.object({
    deviceAdaptationEnabled: z.boolean().default(true),
    locationAwarenessEnabled: z.boolean().default(true),
    backgroundSyncEnabled: z.boolean().default(true),
    offlineQueueEnabled: z.boolean().default(true),
    pushOptimizationEnabled: z.boolean().default(true),
    batteryOptimizationEnabled: z.boolean().default(true),
    dataUsageOptimizationEnabled: z.boolean().default(true),
  }),

  // Monitoring Configuration
  monitoring: z.object({
    enabled: z.boolean().default(true),
    metricsCollectionIntervalMs: z.number().default(60000), // 1 minute
    performanceTrackingEnabled: z.boolean().default(true),
    errorTrackingEnabled: z.boolean().default(true),
    analyticsEnabled: z.boolean().default(true),
    detailedLoggingEnabled: z.boolean().default(false),
  }),

  // Security Configuration
  security: z.object({
    rateLimitingEnabled: z.boolean().default(true),
    requestValidationEnabled: z.boolean().default(true),
    corsEnabled: z.boolean().default(true),
    helmetSecurityEnabled: z.boolean().default(true),
    inputSanitizationEnabled: z.boolean().default(true),
  }),

  // Development Configuration
  development: z.object({
    debugModeEnabled: z.boolean().default(false),
    verboseLoggingEnabled: z.boolean().default(false),
    mockDataEnabled: z.boolean().default(false),
    hotReloadEnabled: z.boolean().default(false),
  }),
});

export type MobileOptimizationConfig = z.infer<typeof MobileOptimizationConfigSchema>;

/**
 * Default configuration for mobile optimization framework
 */
export const DEFAULT_MOBILE_OPTIMIZATION_CONFIG: MobileOptimizationConfig = {
  performance: {
    maxResponseTimeMs: 200,
    maxBundleSizeMB: 150,
    maxBatteryDrainPercent: 5,
    maxDataUsageMBPerDay: 50,
    maxConnectionTimeMs: 2000,
  },
  caching: {
    enabled: true,
    edgeCacheTTL: 3600,
    applicationCacheTTL: 300,
    clientCacheTTL: 60,
    databaseCacheTTL: 120,
    cacheCompressionEnabled: true,
    cacheEncryptionEnabled: false,
  },
  network: {
    connectionPoolingEnabled: true,
    maxConnectionsPerHost: 10,
    connectionTimeoutMs: 5000,
    requestTimeoutMs: 30000,
    keepAliveTimeoutMs: 60000,
    requestBatchingEnabled: true,
    maxBatchSize: 10,
    batchDelayMs: 50,
  },
  compression: {
    enabled: true,
    gzipEnabled: true,
    brotliEnabled: true,
    minCompressionSize: 1024,
    compressionLevel: 6,
  },
  mobile: {
    deviceAdaptationEnabled: true,
    locationAwarenessEnabled: true,
    backgroundSyncEnabled: true,
    offlineQueueEnabled: true,
    pushOptimizationEnabled: true,
    batteryOptimizationEnabled: true,
    dataUsageOptimizationEnabled: true,
  },
  monitoring: {
    enabled: true,
    metricsCollectionIntervalMs: 60000,
    performanceTrackingEnabled: true,
    errorTrackingEnabled: true,
    analyticsEnabled: true,
    detailedLoggingEnabled: false,
  },
  security: {
    rateLimitingEnabled: true,
    requestValidationEnabled: true,
    corsEnabled: true,
    helmetSecurityEnabled: true,
    inputSanitizationEnabled: true,
  },
  development: {
    debugModeEnabled: false,
    verboseLoggingEnabled: false,
    mockDataEnabled: false,
    hotReloadEnabled: false,
  },
};

/**
 * Environment-specific configuration overrides
 */
const ENVIRONMENT_CONFIGS = {
  development: {
    development: {
      debugModeEnabled: true,
      verboseLoggingEnabled: true,
      mockDataEnabled: false,
      hotReloadEnabled: true,
    },
    monitoring: {
      detailedLoggingEnabled: true,
    },
  },
  test: {
    development: {
      debugModeEnabled: true,
      mockDataEnabled: true,
    },
    monitoring: {
      enabled: false,
    },
  },
  production: {
    development: {
      debugModeEnabled: false,
      verboseLoggingEnabled: false,
      mockDataEnabled: false,
      hotReloadEnabled: false,
    },
    monitoring: {
      detailedLoggingEnabled: false,
    },
  },
};

/**
 * Mobile Optimization Configuration Manager
 *
 * Handles configuration loading, validation, and environment-specific overrides
 */
export class MobileOptimizationConfigManager {
  private static instance: MobileOptimizationConfigManager;
  private config: MobileOptimizationConfig;
  private environment: string;

  private constructor() {
    this.environment = process.env.NODE_ENV || 'development';
    this.config = this.loadConfiguration();
  }

  public static getInstance(): MobileOptimizationConfigManager {
    if (!MobileOptimizationConfigManager.instance) {
      MobileOptimizationConfigManager.instance = new MobileOptimizationConfigManager();
    }
    return MobileOptimizationConfigManager.instance;
  }

  /**
   * Load configuration with environment-specific overrides
   */
  private loadConfiguration(): MobileOptimizationConfig {
    const baseConfig = { ...DEFAULT_MOBILE_OPTIMIZATION_CONFIG };
    const envOverrides = ENVIRONMENT_CONFIGS[this.environment as keyof typeof ENVIRONMENT_CONFIGS] || {};

    // Apply environment-specific overrides
    this.deepMerge(baseConfig, envOverrides);

    // Validate the final configuration
    try {
      const validatedConfig = MobileOptimizationConfigSchema.parse(baseConfig);
      return validatedConfig;
    } catch (error) {
      console.error('Invalid mobile optimization configuration:', error);
      throw new Error('Failed to load mobile optimization configuration');
    }
  }

  /**
   * Get the complete configuration
   */
  public getConfig(): MobileOptimizationConfig {
    return { ...this.config };
  }

  /**
   * Get a specific configuration section
   */
  public getSection<K extends keyof MobileOptimizationConfig>(
    section: K
  ): MobileOptimizationConfig[K] {
    return { ...this.config[section] };
  }

  /**
   * Update configuration (primarily for testing)
   */
  public updateConfig(updates: Partial<MobileOptimizationConfig>): void {
    this.deepMerge(this.config, updates);

    // Re-validate after updates
    try {
      const validatedConfig = MobileOptimizationConfigSchema.parse(this.config);
      this.config = validatedConfig;
    } catch (error) {
      console.error('Invalid configuration update:', error);
      throw new Error('Configuration update validation failed');
    }
  }

  /**
   * Deep merge utility for nested objects
   */
  private deepMerge(target: any, source: any): void {
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
          if (!target[key] || typeof target[key] !== 'object') {
            target[key] = {};
          }
          this.deepMerge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
    }
  }

  /**
   * Check if a specific feature is enabled
   */
  public isFeatureEnabled(feature: string): boolean {
    const featurePath = feature.split('.');
    let current: any = this.config;

    for (const segment of featurePath) {
      if (current && typeof current === 'object' && segment in current) {
        current = current[segment];
      } else {
        return false;
      }
    }

    return Boolean(current);
  }

  /**
   * Get configuration value by path
   */
  public getValue(path: string): any {
    const pathSegments = path.split('.');
    let current: any = this.config;

    for (const segment of pathSegments) {
      if (current && typeof current === 'object' && segment in current) {
        current = current[segment];
      } else {
        return undefined;
      }
    }

    return current;
  }
}

// Export singleton instance
export const mobileOptimizationConfig = MobileOptimizationConfigManager.getInstance();