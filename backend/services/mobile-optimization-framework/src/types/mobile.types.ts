/**
 * Mobile API Optimization Framework Types
 *
 * Comprehensive type definitions for mobile optimization system
 */

import { EventEmitter } from 'events';

// Core error types
export class MobileOptimizationError extends Error {
  public readonly code: string;
  public readonly context?: Record<string, any>;

  constructor(code: string, message: string, context?: Record<string, any>) {
    super(message);
    this.name = 'MobileOptimizationError';
    this.code = code;
    this.context = context;
  }
}

// Network condition types
export interface NetworkConditions {
  type: 'wifi' | 'cellular' | 'unknown';
  quality: 'excellent' | 'good' | 'poor' | 'offline';
  bandwidth: number; // Mbps
  latency: number; // ms
  packetLoss: number; // percentage
  signalStrength?: number; // dBm
  carrier?: string;
}

export interface NetworkOptimizationResult {
  applied: boolean;
  optimizations: string[];
  metadata: Record<string, any>;
}

// Device information types
export interface DeviceInfo {
  id: string;
  type: 'ios' | 'android' | 'web';
  osVersion: string;
  appVersion: string;
  screenSize: {
    width: number;
    height: number;
  };
  devicePixelRatio: number;
  memory: number; // MB
  storage: number; // MB
  batteryLevel?: number;
  isLowPowerMode?: boolean;
  timezone: string;
  locale: string;
}

export interface DeviceOptimizationResult {
  applied: boolean;
  optimizations: string[];
  metadata: Record<string, any>;
}

// Cache types
export interface CacheEntry<T = any> {
  key: string;
  data: T;
  timestamp: number;
  ttl: number;
  layer: 'edge' | 'application' | 'client' | 'database';
  compressed: boolean;
  encrypted: boolean;
  metadata: Record<string, any>;
}

export interface CacheResult<T = any> {
  hit: boolean;
  data?: T;
  layer?: string;
  key?: string;
  fromCompression?: boolean;
  fromEncryption?: boolean;
}

// Payload optimization types
export interface PayloadOptimizationResult<T = any> {
  optimized: boolean;
  data: T;
  optimizations: string[];
  metadata: {
    originalSize: number;
    optimizedSize: number;
    compressionRatio: number;
    compressionMethod?: string;
    fieldsRemoved?: string[];
    fieldsOptimized?: string[];
  };
}

// Background sync types
export interface BackgroundSyncJob {
  id: string;
  endpoint: string;
  method: string;
  data: any;
  context: MobileOptimizationContext;
  priority: 'low' | 'normal' | 'high' | 'critical';
  retryCount: number;
  maxRetries: number;
  createdAt: number;
  scheduledFor: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface BackgroundSyncResult {
  jobId: string;
  success: boolean;
  result?: any;
  error?: string;
  duration: number;
  retryCount: number;
}

// Performance monitoring types
export interface PerformanceMetrics {
  timestamp: number;
  endpoint: string;
  method: string;
  duration: number;
  statusCode: number;
  requestSize: number;
  responseSize: number;
  cacheHit: boolean;
  cacheLayer?: string;
  networkType?: string;
  connectionQuality?: string;
  deviceType?: string;
  optimizations: string[];
  errors: string[];
}

export interface OptimizationAnalytics {
  totalRequests: number;
  totalOptimizations: number;
  cacheHitRate: number;
  averageResponseTime: number;
  averageCompressionRatio: number;
  dataTransferred: number;
  timeSaved: number;
  batterySaved: number;
  optimizationsByType: Record<string, number>;
  errorsByType: Record<string, number>;
  performanceByEndpoint: Record<string, PerformanceMetrics[]>;
}

// Compression types
export interface CompressionOptions {
  enabled: boolean;
  method: 'gzip' | 'brotli' | 'deflate' | 'none';
  level: number; // 1-9
  minSize: number; // minimum size to compress
  threshold: number; // compression ratio threshold
}

export interface CompressionResult {
  compressed: boolean;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  method: string;
  duration: number;
}

// Mobile optimization context (from MobileOptimizer)
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

// Event types for the system
export interface MobileOptimizationEvents {
  // Core events
  initialized: [];
  shutdown: [];
  error: [MobileOptimizationError];

  // Network events
  networkChange: [NetworkConditions];
  networkOptimized: [NetworkOptimizationResult];

  // Cache events
  cacheHit: [CacheEntry];
  cacheMiss: [string];
  cacheEvicted: [string];

  // Performance events
  performanceAlert: [PerformanceMetrics];
  optimizationApplied: [string, any];

  // Background sync events
  syncStarted: [BackgroundSyncJob];
  syncCompleted: [BackgroundSyncResult];
  syncFailed: [BackgroundSyncResult];

  // Device events
  deviceOptimized: [DeviceOptimizationResult];
  batteryLow: [number];
  storageLow: [number];
}

// Configuration types
export interface MobileOptimizationConfig {
  performance: {
    maxResponseTimeMs: number;
    maxBundleSizeMB: number;
    maxBatteryDrainPercent: number;
    maxDataUsageMBPerDay: number;
    maxConnectionTimeMs: number;
  };
  caching: {
    enabled: boolean;
    edgeCacheTTL: number;
    applicationCacheTTL: number;
    clientCacheTTL: number;
    databaseCacheTTL: number;
    cacheCompressionEnabled: boolean;
    cacheEncryptionEnabled: boolean;
  };
  network: {
    connectionPoolingEnabled: boolean;
    maxConnectionsPerHost: number;
    connectionTimeoutMs: number;
    requestTimeoutMs: number;
    keepAliveTimeoutMs: number;
    requestBatchingEnabled: boolean;
    maxBatchSize: number;
    batchDelayMs: number;
  };
  compression: {
    enabled: boolean;
    gzipEnabled: boolean;
    brotliEnabled: boolean;
    minCompressionSize: number;
    compressionLevel: number;
  };
  mobile: {
    deviceAdaptationEnabled: boolean;
    locationAwarenessEnabled: boolean;
    backgroundSyncEnabled: boolean;
    offlineQueueEnabled: boolean;
    pushOptimizationEnabled: boolean;
    batteryOptimizationEnabled: boolean;
    dataUsageOptimizationEnabled: boolean;
  };
  monitoring: {
    enabled: boolean;
    metricsCollectionIntervalMs: number;
    performanceTrackingEnabled: boolean;
    errorTrackingEnabled: boolean;
    analyticsEnabled: boolean;
    detailedLoggingEnabled: boolean;
  };
  security: {
    rateLimitingEnabled: boolean;
    requestValidationEnabled: boolean;
    corsEnabled: boolean;
    helmetSecurityEnabled: boolean;
    inputSanitizationEnabled: boolean;
  };
  development: {
    debugModeEnabled: boolean;
    verboseLoggingEnabled: boolean;
    mockDataEnabled: boolean;
    hotReloadEnabled: boolean;
  };
}

// Express middleware types
export interface MobileOptimizationMiddlewareOptions {
  enableCompression?: boolean;
  enableCaching?: boolean;
  enableNetworkOptimization?: boolean;
  enableDeviceAdaptation?: boolean;
  enableMonitoring?: boolean;
  trustProxy?: boolean;
  corsOrigins?: string[];
  rateLimitWindowMs?: number;
  rateLimitMax?: number;
}

// WebSocket optimization types
export interface WebSocketOptimizationConfig {
  heartbeatInterval: number;
  reconnectDelay: number;
  maxReconnectAttempts: number;
  messageBatchSize: number;
  messageBatchDelay: number;
  enableCompression: boolean;
  enableObjectPooling: boolean;
  connectionPoolSize: number;
}

export interface WebSocketOptimizationResult {
  optimized: boolean;
  optimizations: string[];
  compressionEnabled: boolean;
  batchingEnabled: boolean;
  poolingEnabled: boolean;
  metrics: {
    messagesSent: number;
    messagesReceived: number;
    bytesSent: number;
    bytesReceived: number;
    compressionRatio: number;
  };
}

// Integration adapter types
export interface ExpressAdapterConfig {
  compression?: CompressionOptions;
  rateLimiting?: {
    windowMs: number;
    max: number;
    message?: string;
  };
  cors?: {
    origin: string | string[];
    credentials: boolean;
  };
  security?: {
    helmet: boolean;
    inputValidation: boolean;
  };
}

export interface UnityAdapterConfig {
  websocketUrl: string;
  autoReconnect: boolean;
  messageBatching: boolean;
  objectPooling: boolean;
  compressionEnabled: boolean;
  offlineModeEnabled: boolean;
  performanceMonitoring: boolean;
}

// Health check types
export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  uptime: number;
  version: string;
  subsystems: Record<string, {
    status: 'up' | 'down' | 'degraded';
    responseTime?: number;
    error?: string;
  }>;
  metrics: {
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    cacheHitRate: number;
  };
}

// Battery optimization types
export interface BatteryOptimizationConfig {
  enabled: boolean;
  aggressiveMode: boolean;
  backgroundSyncDisabled: boolean;
  reducedPolling: boolean;
  imageOptimization: boolean;
  videoOptimization: boolean;
  audioOptimization: boolean;
  networkOptimization: boolean;
}

export interface BatteryOptimizationResult {
  optimizations: string[];
  estimatedBatterySavings: number; // percentage
  estimatedTimeGained: number; // minutes
  featuresDisabled: string[];
}

// Data usage optimization types
export interface DataUsageOptimizationConfig {
  enabled: boolean;
  cellularOptimization: boolean;
  wifiOptimization: boolean;
  imageCompression: boolean;
  videoCompression: boolean;
  audioCompression: boolean;
  requestBatching: boolean;
  caching: boolean;
  offlineMode: boolean;
}

export interface DataUsageOptimizationResult {
  optimizations: string[];
  estimatedDataSaved: number; // MB
  compressionRatio: number;
  cacheHitRate: number;
  requestsBatched: number;
}

// Push notification optimization types
export interface PushOptimizationConfig {
  enabled: boolean;
  batchNotifications: boolean;
  smartScheduling: boolean;
  batteryAware: boolean;
  networkAware: boolean;
  locationAware: boolean;
  priorityBased: boolean;
}

export interface PushOptimizationResult {
  notificationsSent: number;
  notificationsBatched: number;
  deliveryRate: number;
  averageDeliveryTime: number;
  batteryImpact: number;
}

// Location awareness types
export interface LocationOptimizationConfig {
  enabled: boolean;
  geofencing: boolean;
  regionBasedCaching: boolean;
  localizedContent: boolean;
  timezoneAware: boolean;
  languageDetection: boolean;
}

export interface LocationOptimizationResult {
  optimizations: string[];
  region: string;
  timezone: string;
  language: string;
  localized: boolean;
  cached: boolean;
}

// Offline queue types
export interface OfflineQueueConfig {
  enabled: boolean;
  maxQueueSize: number;
  maxRetryAttempts: number;
  retryDelayMs: number;
  persistenceEnabled: boolean;
  encryptionEnabled: boolean;
}

export interface OfflineQueueItem {
  id: string;
  endpoint: string;
  method: string;
  data: any;
  context: MobileOptimizationContext;
  priority: number;
  attempts: number;
  createdAt: number;
  nextRetryAt: number;
}

export interface OfflineQueueResult {
  queued: number;
  processed: number;
  failed: number;
  pending: number;
  storageUsed: number;
}

// Validation types
export interface ValidationRule {
  field: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean;
  sanitize?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  sanitized?: any;
}

// Memory management types
export interface MemoryPoolConfig {
  initialSize: number;
  maxSize: number;
  growthFactor: number;
  resetThreshold: number;
}

export interface MemoryPoolStats {
  totalAllocated: number;
  totalUsed: number;
  totalFree: number;
  fragmentation: number;
  pools: Record<string, {
    size: number;
    used: number;
    free: number;
  }>;
}

// Security types
export interface SecurityConfig {
  rateLimiting: {
    enabled: boolean;
    windowMs: number;
    max: number;
  };
  inputValidation: {
    enabled: boolean;
    strict: boolean;
    sanitize: boolean;
  };
  cors: {
    enabled: boolean;
    origins: string[];
    credentials: boolean;
  };
  helmet: {
    enabled: boolean;
    contentSecurityPolicy: boolean;
  };
}

// Export all types
export type {
  NetworkConditions,
  NetworkOptimizationResult,
  DeviceInfo,
  DeviceOptimizationResult,
  CacheEntry,
  CacheResult,
  PayloadOptimizationResult,
  BackgroundSyncJob,
  BackgroundSyncResult,
  PerformanceMetrics,
  OptimizationAnalytics,
  CompressionOptions,
  CompressionResult,
  MobileOptimizationContext,
  MobileOptimizationConfig,
  ExpressAdapterConfig,
  UnityAdapterConfig,
  HealthCheckResult,
  BatteryOptimizationConfig,
  BatteryOptimizationResult,
  DataUsageOptimizationConfig,
  DataUsageOptimizationResult,
  PushOptimizationConfig,
  PushOptimizationResult,
  LocationOptimizationConfig,
  LocationOptimizationResult,
  OfflineQueueConfig,
  OfflineQueueItem,
  OfflineQueueResult,
  ValidationRule,
  ValidationResult,
  MemoryPoolConfig,
  MemoryPoolStats,
  SecurityConfig,
  WebSocketOptimizationConfig,
  WebSocketOptimizationResult,
};

// Event emitter type for mobile optimizer
export interface MobileOptimizerEvents extends EventEmitter {
  on<K extends keyof MobileOptimizationEvents>(
    event: K,
    listener: (...args: MobileOptimizationEvents[K]) => void
  ): this;

  off<K extends keyof MobileOptimizationEvents>(
    event: K,
    listener: (...args: MobileOptimizationEvents[K]) => void
  ): this;

  emit<K extends keyof MobileOptimizationEvents>(
    event: K,
    ...args: MobileOptimizationEvents[K]
  ): boolean;
}