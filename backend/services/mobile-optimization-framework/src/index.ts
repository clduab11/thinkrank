/**
 * Mobile API Optimization Framework for ThinkRank
 *
 * Comprehensive mobile optimization system designed to achieve:
 * - <200ms API response times for 95th percentile
 * - <150MB cellular download compliance
 * - <5% additional battery drain
 * - <50MB/day data usage for active users
 * - <2s connection establishment time
 *
 * Architecture Components:
 * 1. Multi-layer caching strategy
 * 2. Network-aware optimization
 * 3. Connection management and pooling
 * 4. Payload compression and optimization
 * 5. Mobile-specific API features
 * 6. Performance monitoring and analytics
 */

// Core framework exports
export * from './core/MobileOptimizer';
export * from './core/MobileOptimizationConfig';

// Caching system
export * from './caching/MultiLayerCache';
export * from './caching/CacheStrategy';
export * from './caching/MobileCacheManager';

// Network optimization
export * from './network/NetworkAwarenessManager';
export * from './network/ConnectionManager';
export * from './network/RequestBatcher';
export * from './network/NetworkConditionDetector';

// Payload optimization
export * from './payload/PayloadOptimizer';
export * from './payload/CompressionManager';
export * from './payload/ResponseFormatter';

// Mobile-specific features
export * from './mobile/BackgroundSyncManager';
export * from './mobile/DeviceAdaptationManager';
export * from './mobile/OfflineQueueManager';
export * from './mobile/PushOptimizationManager';

// Performance monitoring
export * from './monitoring/PerformanceMonitor';
export * from './monitoring/MetricsCollector';
export * from './monitoring/OptimizationAnalytics';

// Integration adapters
export * from './adapters/WebSocketAdapter';
export * from './adapters/ExpressMiddlewareAdapter';
export * from './adapters/UnityMobileAdapter';

// Types and interfaces
export * from './types/mobile.types';
export * from './types/cache.types';
export * from './types/network.types';
export * from './types/monitoring.types';

// Utilities
export * from './utils/Logger';
export * from './utils/ValidationUtils';
export * from './utils/MemoryManager';