/**
 * ThinkRank Mobile-Optimized API
 * Efficient challenge delivery and response handling for mobile clients
 *
 * RESPONSIBILITIES:
 * - Mobile-optimized RESTful API endpoints for challenge operations
 * - Efficient data structures for minimal bandwidth usage
 * - Compressed response handling for mobile networks
 * - Adaptive response sizing based on device capabilities
 * - Offline queue management for intermittent connectivity
 * - Battery-aware processing and optimization
 *
 * PERFORMANCE TARGETS:
 * - <200ms challenge response times for mobile engagement
 * - <50ms user input evaluation
 * - Efficient data structures for mobile bandwidth
 * - Compressed responses for slower connections
 * - Adaptive quality based on device capabilities
 */

import express, { Request, Response, NextFunction } from 'express';
import compression from 'compression';
import { ChallengeEngine, Challenge, ChallengeSubmission, ChallengeResult } from '../core/ChallengeEngine';
import { ScoringSystem } from '../core/ScoringSystem';
import { RealtimeService } from '../realtime/RealtimeService';
import { MobileOptimizer } from './MobileOptimizer';
import { BandwidthManager } from './BandwidthManager';
import { OfflineQueue } from './OfflineQueue';

export interface MobileAPIConfig {
  port: number;
  compressionThreshold: number;
  mobileOptimizations: MobileAPIOptimizations;
  rateLimiting: RateLimitingConfig;
  offlineSupport: OfflineSupportConfig;
}

export interface MobileAPIOptimizations {
  adaptiveResponseSize: boolean;
  imageOptimization: boolean;
  lazyLoading: boolean;
  predictiveCaching: boolean;
  batteryOptimization: boolean;
}

export interface RateLimitingConfig {
  requestsPerMinute: number;
  burstLimit: number;
  mobileMultiplier: number;
}

export interface OfflineSupportConfig {
  queueEnabled: boolean;
  maxQueueSize: number;
  syncInterval: number;
  conflictResolution: ConflictResolutionStrategy;
}

export enum ConflictResolutionStrategy {
  LAST_WRITE_WINS = 'last_write_wins',
  SERVER_STATE_WINS = 'server_state_wins',
  MERGE_STRATEGY = 'merge_strategy'
}

export interface MobileRequest extends Request {
  deviceInfo?: DeviceInfo;
  networkInfo?: NetworkInfo;
  batteryInfo?: BatteryInfo;
  optimizationFlags?: OptimizationFlags;
}

export interface DeviceInfo {
  type: 'mobile' | 'tablet' | 'desktop';
  os: string;
  osVersion: string;
  screenWidth: number;
  screenHeight: number;
  pixelRatio: number;
  capabilities: DeviceCapabilities;
}

export interface DeviceCapabilities {
  maxTextureSize: number;
  supportedFormats: string[];
  hasWebGL: boolean;
  memoryLimit: number;
  cpuCores: number;
}

export interface NetworkInfo {
  type: NetworkType;
  downlink: number;
  rtt: number;
  saveData: boolean;
  effectiveType: EffectiveConnectionType;
}

export enum NetworkType {
  WIFI = 'wifi',
  CELLULAR_2G = '2g',
  CELLULAR_3G = '3g',
  CELLULAR_4G = '4g',
  CELLULAR_5G = '5g',
  UNKNOWN = 'unknown'
}

export enum EffectiveConnectionType {
  SLOW_2G = 'slow-2g',
  FAST_2G = '2g',
  SLOW_3G = 'slow-3g',
  FAST_3G = '3g',
  SLOW_4G = 'slow-4g',
  FAST_4G = '4g',
  UNKNOWN = 'unknown'
}

export interface BatteryInfo {
  level: number;
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
}

export interface OptimizationFlags {
  compressedResponse: boolean;
  reducedQuality: boolean;
  skipAnimations: boolean;
  disableSounds: boolean;
  lowPowerMode: boolean;
}

export interface MobileResponse<T = any> {
  data: T;
  metadata: ResponseMetadata;
  optimizations?: ResponseOptimizations;
  offlineQueue?: OfflineAction[];
}

export interface ResponseMetadata {
  responseTime: number;
  dataSize: number;
  compressed: boolean;
  cacheable: boolean;
  expiresAt?: Date;
  etag?: string;
}

export interface ResponseOptimizations {
  qualityReduced: boolean;
  imagesOptimized: boolean;
  animationsSkipped: boolean;
  soundsDisabled: boolean;
}

export interface OfflineAction {
  id: string;
  type: string;
  payload: any;
  timestamp: Date;
  retryCount: number;
  priority: number;
}

export class MobileAPI {
  private app: express.Application;
  private config: MobileAPIConfig;
  private challengeEngine: ChallengeEngine;
  private scoringSystem: ScoringSystem;
  private realtimeService: RealtimeService;
  private mobileOptimizer: MobileOptimizer;
  private bandwidthManager: BandwidthManager;
  private offlineQueue: OfflineQueue;
  private performanceMetrics: MobileAPIPerformanceMetrics;

  constructor(
    challengeEngine: ChallengeEngine,
    scoringSystem: ScoringSystem,
    realtimeService: RealtimeService,
    config: MobileAPIConfig
  ) {
    this.app = express();
    this.config = config;
    this.challengeEngine = challengeEngine;
    this.scoringSystem = scoringSystem;
    this.realtimeService = realtimeService;
    this.performanceMetrics = new MobileAPIPerformanceMetrics();

    // Initialize subsystems
    this.mobileOptimizer = new MobileOptimizer(config.mobileOptimizations);
    this.bandwidthManager = new BandwidthManager();
    this.offlineQueue = new OfflineQueue(config.offlineSupport);

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Start the mobile API server
   */
  async start(): Promise<void> {
    try {
      await this.offlineQueue.initialize();
      await this.realtimeService.start();

      return new Promise((resolve) => {
        this.app.listen(this.config.port, () => {
          console.log(`Mobile API server started on port ${this.config.port}`);
          resolve();
        });
      });
    } catch (error) {
      throw new MobileAPIError('Failed to start mobile API server', error);
    }
  }

  /**
   * Stop the mobile API server
   */
  async stop(): Promise<void> {
    try {
      await this.offlineQueue.cleanup();
      await this.realtimeService.stop();

      console.log('Mobile API server stopped');
    } catch (error) {
      throw new MobileAPIError('Failed to stop mobile API server', error);
    }
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Device and network detection middleware
    this.app.use(this.deviceDetectionMiddleware.bind(this));
    this.app.use(this.networkDetectionMiddleware.bind(this));
    this.app.use(this.batteryDetectionMiddleware.bind(this));

    // Compression middleware
    this.app.use(compression({
      threshold: this.config.compressionThreshold,
      filter: (req: Request, res: Response) => {
        const mobileReq = req as MobileRequest;
        return mobileReq.optimizationFlags?.compressedResponse !== false;
      }
    }));

    // Rate limiting middleware
    this.app.use(this.rateLimitingMiddleware.bind(this));

    // JSON parsing with size limits
    this.app.use(express.json({
      limit: '1mb',
      strict: true
    }));

    // CORS for mobile clients
    this.app.use(this.corsMiddleware.bind(this));

    // Request logging
    this.app.use(this.requestLoggingMiddleware.bind(this));
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Challenge routes
    this.app.post('/api/mobile/challenges/generate', this.generateChallenge.bind(this));
    this.app.get('/api/mobile/challenges/:challengeId', this.getChallenge.bind(this));
    this.app.get('/api/mobile/challenges', this.getActiveChallenges.bind(this));
    this.app.post('/api/mobile/challenges/:challengeId/submit', this.submitChallenge.bind(this));
    this.app.post('/api/mobile/challenges/:challengeId/join', this.joinChallenge.bind(this));

    // Real-time routes
    this.app.get('/api/mobile/realtime/status', this.getRealtimeStatus.bind(this));
    this.app.post('/api/mobile/realtime/connect', this.handleRealtimeConnect.bind(this));

    // Offline support routes
    this.app.get('/api/mobile/offline/queue', this.getOfflineQueue.bind(this));
    this.app.post('/api/mobile/offline/sync', this.syncOfflineActions.bind(this));

    // Performance and optimization routes
    this.app.get('/api/mobile/optimization/config', this.getOptimizationConfig.bind(this));
    this.app.post('/api/mobile/optimization/update', this.updateOptimizationFlags.bind(this));

    // Health check
    this.app.get('/api/mobile/health', this.healthCheck.bind(this));
  }

  /**
   * Generate a new challenge optimized for mobile
   */
  private async generateChallenge(req: MobileRequest, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const { challengeType, difficulty, preferences } = req.body;
      const playerId = this.extractPlayerId(req);

      if (!playerId) {
        res.status(401).json(this.createErrorResponse('Player ID required'));
        return;
      }

      // Generate challenge using challenge engine
      const challenge = await this.challengeEngine.generateChallenge(
        playerId,
        challengeType,
        difficulty
      );

      // Optimize challenge for mobile delivery
      const optimizedChallenge = await this.mobileOptimizer.optimizeChallenge(
        challenge,
        req.deviceInfo!,
        req.networkInfo!
      );

      // Create mobile response
      const response: MobileResponse = {
        data: optimizedChallenge,
        metadata: {
          responseTime: Date.now() - startTime,
          dataSize: JSON.stringify(optimizedChallenge).length,
          compressed: req.optimizationFlags?.compressedResponse || false,
          cacheable: true,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
        },
        optimizations: {
          qualityReduced: req.optimizationFlags?.reducedQuality || false,
          imagesOptimized: req.deviceInfo?.capabilities.hasWebGL || false,
          animationsSkipped: req.optimizationFlags?.skipAnimations || false,
          soundsDisabled: req.optimizationFlags?.disableSounds || false
        }
      };

      // Record performance metrics
      this.performanceMetrics.recordChallengeGeneration(Date.now() - startTime);

      res.json(response);

    } catch (error) {
      this.performanceMetrics.recordError('challenge_generation', error);
      res.status(500).json(this.createErrorResponse('Failed to generate challenge', error));
    }
  }

  /**
   * Get challenge details optimized for mobile
   */
  private async getChallenge(req: MobileRequest, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const { challengeId } = req.params;
      const challenge = await this.challengeEngine.getChallenge(challengeId);

      if (!challenge) {
        res.status(404).json(this.createErrorResponse('Challenge not found'));
        return;
      }

      // Optimize for mobile
      const optimizedChallenge = await this.mobileOptimizer.optimizeChallenge(
        challenge,
        req.deviceInfo!,
        req.networkInfo!
      );

      const response: MobileResponse = {
        data: optimizedChallenge,
        metadata: {
          responseTime: Date.now() - startTime,
          dataSize: JSON.stringify(optimizedChallenge).length,
          compressed: req.optimizationFlags?.compressedResponse || false,
          cacheable: true
        }
      };

      this.performanceMetrics.recordChallengeRetrieval(Date.now() - startTime);
      res.json(response);

    } catch (error) {
      this.performanceMetrics.recordError('challenge_retrieval', error);
      res.status(500).json(this.createErrorResponse('Failed to get challenge', error));
    }
  }

  /**
   * Submit challenge answer with mobile optimizations
   */
  private async submitChallenge(req: MobileRequest, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const { challengeId } = req.params;
      const submissionData = req.body;

      // Create submission object
      const submission: ChallengeSubmission = {
        challengeId,
        playerId: this.extractPlayerId(req)!,
        answer: submissionData.answer,
        confidence: submissionData.confidence,
        responseTime: submissionData.responseTime,
        submittedAt: new Date(),
        metadata: {
          deviceType: req.deviceInfo?.type || 'unknown',
          networkLatency: req.networkInfo?.rtt || 0,
          retryCount: submissionData.retryCount || 0,
          timeSpentThinking: submissionData.timeSpentThinking || 0
        }
      };

      // Process submission
      const result = await this.challengeEngine.submitChallengeAnswer(submission);

      // Optimize result for mobile
      const optimizedResult = await this.mobileOptimizer.optimizeResult(
        result,
        req.deviceInfo!,
        req.networkInfo!
      );

      const response: MobileResponse = {
        data: optimizedResult,
        metadata: {
          responseTime: Date.now() - startTime,
          dataSize: JSON.stringify(optimizedResult).length,
          compressed: req.optimizationFlags?.compressedResponse || false,
          cacheable: false
        }
      };

      // Check if response time meets performance target
      if (Date.now() - startTime > 200) {
        this.performanceMetrics.recordSlowResponse('challenge_submission');
      } else {
        this.performanceMetrics.recordFastResponse('challenge_submission');
      }

      res.json(response);

    } catch (error) {
      this.performanceMetrics.recordError('challenge_submission', error);
      res.status(500).json(this.createErrorResponse('Failed to submit challenge', error));
    }
  }

  /**
   * Get active challenges optimized for mobile browsing
   */
  private async getActiveChallenges(req: MobileRequest, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const playerId = this.extractPlayerId(req);
      if (!playerId) {
        res.status(401).json(this.createErrorResponse('Player ID required'));
        return;
      }

      const challenges = await this.challengeEngine.getActiveChallenges(playerId);

      // Optimize challenges for mobile list view
      const optimizedChallenges = await Promise.all(
        challenges.map(challenge =>
          this.mobileOptimizer.optimizeChallengeForList(challenge, req.deviceInfo!)
        )
      );

      const response: MobileResponse = {
        data: {
          challenges: optimizedChallenges,
          totalCount: challenges.length,
          hasMore: false
        },
        metadata: {
          responseTime: Date.now() - startTime,
          dataSize: JSON.stringify(optimizedChallenges).length,
          compressed: req.optimizationFlags?.compressedResponse || false,
          cacheable: true,
          expiresAt: new Date(Date.now() + 2 * 60 * 1000) // 2 minutes
        }
      };

      this.performanceMetrics.recordListRetrieval(Date.now() - startTime);
      res.json(response);

    } catch (error) {
      this.performanceMetrics.recordError('active_challenges', error);
      res.status(500).json(this.createErrorResponse('Failed to get active challenges', error));
    }
  }

  /**
   * Get real-time connection status
   */
  private async getRealtimeStatus(req: MobileRequest, res: Response): Promise<void> {
    const stats = this.realtimeService.getStatistics();

    const response: MobileResponse = {
      data: {
        connected: stats.activeConnections > 0,
        connectionCount: stats.activeConnections,
        mobileConnections: stats.mobileConnections,
        averageLatency: stats.averageLatency,
        quality: this.calculateConnectionQuality(stats)
      },
      metadata: {
        responseTime: 0,
        dataSize: 0,
        compressed: false,
        cacheable: false
      }
    };

    res.json(response);
  }

  /**
   * Get offline queue status
   */
  private async getOfflineQueue(req: MobileRequest, res: Response): Promise<void> {
    const playerId = this.extractPlayerId(req);
    if (!playerId) {
      res.status(401).json(this.createErrorResponse('Player ID required'));
      return;
    }

    const queue = await this.offlineQueue.getPlayerQueue(playerId);
    const syncStatus = await this.offlineQueue.getSyncStatus(playerId);

    const response: MobileResponse = {
      data: {
        queueLength: queue.length,
        syncStatus,
        canSync: queue.length > 0 && syncStatus.lastSync < Date.now() - this.config.offlineSupport.syncInterval
      },
      metadata: {
        responseTime: 0,
        dataSize: 0,
        compressed: false,
        cacheable: true,
        expiresAt: new Date(Date.now() + 30 * 1000) // 30 seconds
      }
    };

    res.json(response);
  }

  /**
   * Sync offline actions
   */
  private async syncOfflineActions(req: MobileRequest, res: Response): Promise<void> {
    const playerId = this.extractPlayerId(req);
    if (!playerId) {
      res.status(401).json(this.createErrorResponse('Player ID required'));
      return;
    }

    try {
      const { actions } = req.body;

      // Add actions to offline queue
      await this.offlineQueue.addActions(playerId, actions);

      // Process sync
      const syncResults = await this.offlineQueue.processSync(playerId);

      const response: MobileResponse = {
        data: {
          syncedCount: syncResults.syncedCount,
          failedCount: syncResults.failedCount,
          remainingCount: syncResults.remainingCount,
          conflicts: syncResults.conflicts
        },
        metadata: {
          responseTime: 0,
          dataSize: 0,
          compressed: false,
          cacheable: false
        }
      };

      res.json(response);

    } catch (error) {
      this.performanceMetrics.recordError('offline_sync', error);
      res.status(500).json(this.createErrorResponse('Failed to sync offline actions', error));
    }
  }

  /**
   * Get optimization configuration for client
   */
  private async getOptimizationConfig(req: MobileRequest, res: Response): Promise<void> {
    const config = await this.mobileOptimizer.getClientConfig(
      req.deviceInfo!,
      req.networkInfo!,
      req.batteryInfo!
    );

    const response: MobileResponse = {
      data: config,
      metadata: {
        responseTime: 0,
        dataSize: 0,
        compressed: false,
        cacheable: true,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
      }
    };

    res.json(response);
  }

  /**
   * Health check endpoint
   */
  private async healthCheck(req: MobileRequest, res: Response): Promise<void> {
    const health = {
      status: 'healthy',
      timestamp: new Date(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      performance: this.performanceMetrics.getSummary()
    };

    res.json(health);
  }

  // Middleware methods
  private deviceDetectionMiddleware(req: MobileRequest, res: Response, next: NextFunction): void {
    const userAgent = req.get('User-Agent') || '';
    const deviceInfo: DeviceInfo = this.parseDeviceInfo(userAgent, req);

    req.deviceInfo = deviceInfo;
    req.optimizationFlags = this.generateOptimizationFlags(deviceInfo);

    next();
  }

  private networkDetectionMiddleware(req: MobileRequest, res: Response, next: NextFunction): void {
    const networkInfo: NetworkInfo = {
      type: this.detectNetworkType(req),
      downlink: this.getConnectionDownlink(req),
      rtt: this.getConnectionRTT(req),
      saveData: req.get('Save-Data') === 'on',
      effectiveType: this.getEffectiveConnectionType(req)
    };

    req.networkInfo = networkInfo;

    // Adjust optimization flags based on network
    if (req.optimizationFlags) {
      req.optimizationFlags.compressedResponse = networkInfo.effectiveType === EffectiveConnectionType.SLOW_2G;
      req.optimizationFlags.reducedQuality = networkInfo.saveData;
    }

    next();
  }

  private batteryDetectionMiddleware(req: MobileRequest, res: Response, next: NextFunction): void {
    const batteryHeader = req.get('X-Battery-Level');
    const chargingHeader = req.get('X-Battery-Charging');

    if (batteryHeader || chargingHeader) {
      req.batteryInfo = {
        level: batteryHeader ? parseFloat(batteryHeader) : 1.0,
        charging: chargingHeader === 'true',
        chargingTime: 0,
        dischargingTime: 0
      };

      // Enable battery optimization if low battery
      if (req.batteryInfo.level < 0.2 && !req.batteryInfo.charging) {
        req.optimizationFlags = req.optimizationFlags || {};
        req.optimizationFlags.lowPowerMode = true;
        req.optimizationFlags.reducedQuality = true;
        req.optimizationFlags.skipAnimations = true;
        req.optimizationFlags.disableSounds = true;
      }
    }

    next();
  }

  private rateLimitingMiddleware(req: MobileRequest, res: Response, next: NextFunction): void {
    const playerId = this.extractPlayerId(req);
    const deviceType = req.deviceInfo?.type;

    // Apply different rate limits based on device type
    const multiplier = deviceType === 'mobile' ? this.config.rateLimiting.mobileMultiplier : 1.0;
    const limit = Math.floor(this.config.rateLimiting.requestsPerMinute * multiplier);

    // Simple in-memory rate limiting (in production, use Redis)
    const key = `${playerId || req.ip}_${deviceType}`;
    const now = Date.now();
    const window = 60 * 1000; // 1 minute

    // Implementation would track requests per window
    // For now, just pass through
    next();
  }

  private corsMiddleware(req: MobileRequest, res: Response, next: NextFunction): void {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Device-Type, X-Network-Type, X-Battery-Level');

    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  }

  private requestLoggingMiddleware(req: MobileRequest, res: Response, next: NextFunction): void {
    const startTime = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      console.log(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms - ${req.deviceInfo?.type || 'unknown'}`);
    });

    next();
  }

  private setupErrorHandling(): void {
    this.app.use((error: any, req: MobileRequest, res: Response, next: NextFunction) => {
      this.performanceMetrics.recordError('api_error', error);

      console.error('API Error:', error);

      const mobileError = {
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      };

      res.status(500).json(mobileError);
    });
  }

  // Helper methods
  private extractPlayerId(req: MobileRequest): string | null {
    return req.headers.authorization?.replace('Bearer ', '') || null;
  }

  private createErrorResponse(message: string, error?: any): any {
    return {
      error: message,
      timestamp: new Date(),
      details: process.env.NODE_ENV === 'development' ? error : undefined
    };
  }

  private parseDeviceInfo(userAgent: string, req: MobileRequest): DeviceInfo {
    // Simplified device detection - in production, use a proper library
    const isMobile = /mobile|android|iphone|ipod|blackberry|windows phone/i.test(userAgent);
    const isTablet = /tablet|ipad/i.test(userAgent);

    let deviceType: 'mobile' | 'tablet' | 'desktop' = 'desktop';
    if (isMobile) deviceType = 'mobile';
    else if (isTablet) deviceType = 'tablet';

    return {
      type: deviceType,
      os: this.detectOS(userAgent),
      osVersion: this.detectOSVersion(userAgent),
      screenWidth: 375, // Default mobile width
      screenHeight: 667, // Default mobile height
      pixelRatio: 2,
      capabilities: {
        maxTextureSize: deviceType === 'mobile' ? 2048 : 4096,
        supportedFormats: ['jpg', 'png', 'webp'],
        hasWebGL: deviceType !== 'mobile' || true, // Most modern mobile devices support WebGL
        memoryLimit: deviceType === 'mobile' ? 256 : 1024, // MB
        cpuCores: deviceType === 'mobile' ? 4 : 8
      }
    };
  }

  private detectOS(userAgent: string): string {
    if (/android/i.test(userAgent)) return 'Android';
    if (/iphone|ipad|ipod/i.test(userAgent)) return 'iOS';
    if (/windows/i.test(userAgent)) return 'Windows';
    if (/mac os x/i.test(userAgent)) return 'macOS';
    if (/linux/i.test(userAgent)) return 'Linux';
    return 'Unknown';
  }

  private detectOSVersion(userAgent: string): string {
    // Simplified version detection
    const androidMatch = userAgent.match(/Android (\d+\.\d+)/);
    if (androidMatch) return androidMatch[1];

    const iosMatch = userAgent.match(/OS (\d+_\d+)/);
    if (iosMatch) return iosMatch[1].replace('_', '.');

    return 'Unknown';
  }

  private detectNetworkType(req: MobileRequest): NetworkType {
    const connectionHeader = req.get('X-Connection-Type');
    if (connectionHeader) {
      const connection = connectionHeader.toLowerCase();
      if (connection.includes('wifi')) return NetworkType.WIFI;
      if (connection.includes('5g')) return NetworkType.CELLULAR_5G;
      if (connection.includes('4g')) return NetworkType.CELLULAR_4G;
      if (connection.includes('3g')) return NetworkType.CELLULAR_3G;
      if (connection.includes('2g')) return NetworkType.CELLULAR_2G;
    }

    return NetworkType.UNKNOWN;
  }

  private getConnectionDownlink(req: MobileRequest): number {
    const downlinkHeader = req.get('X-Downlink');
    return downlinkHeader ? parseFloat(downlinkHeader) : 10; // Default 10 Mbps
  }

  private getConnectionRTT(req: MobileRequest): number {
    const rttHeader = req.get('X-RTT');
    return rttHeader ? parseInt(rttHeader) : 100; // Default 100ms
  }

  private getEffectiveConnectionType(req: MobileRequest): EffectiveConnectionType {
    const downlink = this.getConnectionDownlink(req);

    if (downlink < 0.1) return EffectiveConnectionType.SLOW_2G;
    if (downlink < 0.7) return EffectiveConnectionType.FAST_2G;
    if (downlink < 1.5) return EffectiveConnectionType.SLOW_3G;
    if (downlink < 5) return EffectiveConnectionType.FAST_3G;
    if (downlink < 10) return EffectiveConnectionType.SLOW_4G;
    return EffectiveConnectionType.FAST_4G;
  }

  private generateOptimizationFlags(deviceInfo: DeviceInfo): OptimizationFlags {
    const isMobile = deviceInfo.type === 'mobile';
    const isLowEnd = deviceInfo.capabilities.memoryLimit < 512;

    return {
      compressedResponse: isMobile,
      reducedQuality: isMobile && isLowEnd,
      skipAnimations: isMobile && isLowEnd,
      disableSounds: false,
      lowPowerMode: false
    };
  }

  private calculateConnectionQuality(stats: any): string {
    if (stats.averageLatency < 50) return 'excellent';
    if (stats.averageLatency < 100) return 'good';
    if (stats.averageLatency < 200) return 'fair';
    return 'poor';
  }

  /**
   * Get the Express app instance for advanced configuration
   */
  getApp(): express.Application {
    return this.app;
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): MobileAPIPerformanceMetrics {
    return this.performanceMetrics;
  }
}

// Supporting classes
export class MobileAPIError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = 'MobileAPIError';
  }
}

export class MobileAPIPerformanceMetrics {
  private metrics: Map<string, number[]> = new Map();

  recordChallengeGeneration(duration: number): void {
    this.recordMetric('challenge_generation', duration);
  }

  recordChallengeRetrieval(duration: number): void {
    this.recordMetric('challenge_retrieval', duration);
  }

  recordChallengeSubmission(duration: number): void {
    this.recordMetric('challenge_submission', duration);
  }

  recordListRetrieval(duration: number): void {
    this.recordMetric('list_retrieval', duration);
  }

  recordSlowResponse(endpoint: string): void {
    this.recordMetric(`slow_response:${endpoint}`, 1);
  }

  recordFastResponse(endpoint: string): void {
    this.recordMetric(`fast_response:${endpoint}`, 1);
  }

  recordError(type: string, error: any): void {
    this.recordMetric(`error:${type}`, 1);
  }

  private recordMetric(key: string, value: number): void {
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    this.metrics.get(key)!.push(value);
  }

  getAverageResponseTime(endpoint?: string): number {
    const key = endpoint ? `challenge_${endpoint}` : 'overall';
    const values = this.metrics.get(key) || [];
    return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
  }

  getSlowResponseCount(endpoint?: string): number {
    const key = endpoint ? `slow_response:${endpoint}` : 'slow_response';
    return (this.metrics.get(key) || []).reduce((sum, val) => sum + val, 0);
  }

  getErrorCount(type?: string): number {
    const key = type ? `error:${type}` : 'error';
    return (this.metrics.get(key) || []).reduce((sum, val) => sum + val, 0);
  }

  getSummary(): any {
    return {
      averageGenerationTime: this.getAverageResponseTime('generation'),
      averageSubmissionTime: this.getAverageResponseTime('submission'),
      slowResponseCount: this.getSlowResponseCount(),
      errorCount: this.getErrorCount(),
      timestamp: new Date()
    };
  }
}

// Default configuration
export const DEFAULT_MOBILE_API_CONFIG: MobileAPIConfig = {
  port: 3001,
  compressionThreshold: 1024, // Compress responses larger than 1KB
  mobileOptimizations: {
    adaptiveResponseSize: true,
    imageOptimization: true,
    lazyLoading: true,
    predictiveCaching: true,
    batteryOptimization: true
  },
  rateLimiting: {
    requestsPerMinute: 60,
    burstLimit: 10,
    mobileMultiplier: 0.8 // Slightly lower limits for mobile
  },
  offlineSupport: {
    queueEnabled: true,
    maxQueueSize: 100,
    syncInterval: 30000, // 30 seconds
    conflictResolution: ConflictResolutionStrategy.LAST_WRITE_WINS
  }
};