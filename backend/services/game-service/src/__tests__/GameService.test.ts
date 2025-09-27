/**
 * ThinkRank Game Service Test Suite
 * Comprehensive test coverage for core game service components
 *
 * TEST COVERAGE:
 * - ChallengeEngine: Challenge lifecycle and management
 * - ScoringSystem: Multi-dimensional evaluation and confidence calibration
 * - RealtimeService: WebSocket integration and live updates
 * - MobileAPI: Mobile-optimized endpoints and performance
 * - GachaSystem: Probability mechanics and collection management
 * - Integration: Cross-component interaction and data flow
 */

import { ChallengeEngine, Challenge, ChallengeSubmission, ChallengeResult } from '../core/ChallengeEngine';
import { ScoringSystem, ChallengeScore } from '../core/ScoringSystem';
import { RealtimeService } from '../realtime/RealtimeService';
import { MobileAPI } from '../api/MobileAPI';
import { GachaSystem, PullResult } from '../progression/GachaSystem';
import { GameEngine } from '../core/GameEngine';

describe('Game Service Integration Tests', () => {
  let challengeEngine: ChallengeEngine;
  let scoringSystem: ScoringSystem;
  let realtimeService: RealtimeService;
  let mobileAPI: MobileAPI;
  let gachaSystem: GachaSystem;
  let gameEngine: GameEngine;

  beforeAll(async () => {
    // Initialize test configurations
    const challengeConfig = {
      maxConcurrentChallenges: 10,
      challengeTimeoutMs: 300000,
      difficultyProgressionRate: 0.1,
      scoringWeights: { accuracy: 0.4, speed: 0.2, confidence: 0.2, reasoning: 0.2 },
      aiModelConfig: { modelName: 'test-model', temperature: 0.7, maxTokens: 1000, biasDetectionEnabled: true, contentGenerationEnabled: true },
      realtimeConfig: { websocketEnabled: true, updateInterval: 1000, maxConnections: 100 }
    };

    const scoringConfig = {
      defaultWeights: { accuracy: 0.4, speed: 0.2, confidence: 0.2, reasoning: 0.2 },
      confidenceCalibrationEnabled: true,
      adaptiveWeightingEnabled: true,
      performanceBenchmarks: {
        averageResponseTime: 30000,
        accuracyThresholds: new Map(),
        speedThresholds: new Map(),
        reasoningQualityStandards: new Map()
      },
      timeDecayFactors: { speedDecayRate: 0.001, accuracyDecayRate: 0.0005, reasoningDecayRate: 0.0002, confidenceDecayRate: 0.0001 },
      mobileOptimizations: { networkLatencyCompensation: 0.1, deviceTypeAdjustments: new Map(), batteryOptimizationMode: false, reducedPrecisionMode: false }
    };

    const realtimeConfig = {
      port: 8081,
      maxConnections: 100,
      heartbeatInterval: 30000,
      connectionTimeout: 60000,
      maxMessageSize: 10240,
      compressionEnabled: true,
      mobileOptimizations: { bandwidthThrottling: true, adaptiveCompression: true, mobileConnectionPriority: true, reducedHeartbeatMobile: true, offlineQueueEnabled: true }
    };

    const mobileAPIConfig = {
      port: 3002,
      compressionThreshold: 1024,
      mobileOptimizations: { adaptiveResponseSize: true, imageOptimization: true, lazyLoading: true, predictiveCaching: true, batteryOptimization: true },
      rateLimiting: { requestsPerMinute: 60, burstLimit: 10, mobileMultiplier: 0.8 },
      offlineSupport: { queueEnabled: true, maxQueueSize: 100, syncInterval: 30000, conflictResolution: 'last_write_wins' as any }
    };

    const gachaConfig = {
      rarityTiers: [
        { id: 'common', name: 'Common', color: '#9CA3AF', probability: 0.6, baseDropRate: 0.6, items: [], visualEffects: [], guaranteedPulls: 0 },
        { id: 'rare', name: 'Rare', color: '#3B82F6', probability: 0.25, baseDropRate: 0.25, items: [], visualEffects: [], guaranteedPulls: 20 },
        { id: 'epic', name: 'Epic', color: '#8B5CF6', probability: 0.12, baseDropRate: 0.12, items: [], visualEffects: [], guaranteedPulls: 50 },
        { id: 'legendary', name: 'Legendary', color: '#F59E0B', probability: 0.03, baseDropRate: 0.03, items: [], visualEffects: [], guaranteedPulls: 100 }
      ],
      pullCosts: new Map([['single', 100], ['multi_10', 900]]),
      pitySystem: { enabled: true, basePityThreshold: 100, softPityStart: 75, hardPityThreshold: 100, pityIncreaseRate: 0.02, resetOnRarePull: true },
      seasonalPacks: [],
      progressionUnlocks: [],
      analyticsConfig: { trackPullPatterns: true, trackPlayerRetention: true, trackItemPopularity: true, trackRevenueImpact: true, dataRetentionDays: 90 }
    };

    const gameConfig = {
      maxPlayers: 100,
      gameRules: { maxGameDuration: 3600000, maxPlayers: 100, allowedActions: [], scoringRules: {} as any },
      aiConfig: { biasDetectionModel: 'test-model', adaptiveDifficultyEnabled: true, responseLatencyTarget: 100 },
      gachaConfig,
      socialConfig: { achievementSharingEnabled: true, referralBonusEnabled: true, leaderboardUpdateFrequency: 5000 }
    };

    // Initialize all systems
    challengeEngine = new ChallengeEngine(challengeConfig);
    scoringSystem = new ScoringSystem(scoringConfig);
    realtimeService = new RealtimeService(realtimeConfig);
    mobileAPI = new MobileAPI(challengeEngine, scoringSystem, realtimeService, mobileAPIConfig);
    gachaSystem = new GachaSystem(gachaConfig);
    gameEngine = new GameEngine('test-game', gameConfig);

    // Setup test data
    await setupTestData();
  });

  describe('ChallengeEngine Tests', () => {
    test('should generate challenge successfully', async () => {
      const challenge = await challengeEngine.generateChallenge('player1', 'bias_detection', 'beginner');

      expect(challenge).toBeDefined();
      expect(challenge.id).toBeTruthy();
      expect(challenge.type).toBe('bias_detection');
      expect(challenge.difficulty).toBe('beginner');
      expect(challenge.state).toBe('active');
    });

    test('should submit challenge answer and calculate score', async () => {
      const submission: ChallengeSubmission = {
        challengeId: 'test-challenge',
        playerId: 'player1',
        answer: { selectedOptions: ['option1'], reasoning: 'Test reasoning', confidenceLevel: 0.8 },
        confidence: 0.8,
        responseTime: 15000,
        submittedAt: new Date()
      };

      const result = await challengeEngine.submitChallengeAnswer(submission);

      expect(result).toBeDefined();
      expect(result.score.overall).toBeGreaterThanOrEqual(0);
      expect(result.score.overall).toBeLessThanOrEqual(1);
      expect(result.feedback).toBeDefined();
      expect(result.experienceGained).toBeGreaterThan(0);
    });

    test('should get active challenges for player', async () => {
      const challenges = await challengeEngine.getActiveChallenges('player1');

      expect(Array.isArray(challenges)).toBe(true);
      challenges.forEach(challenge => {
        expect(challenge.state).toBe('active');
        expect(challenge.expiresAt.getTime()).toBeGreaterThan(Date.now());
      });
    });

    test('should track player challenge history', async () => {
      const history = await challengeEngine.getPlayerChallengeHistory('player1');

      expect(history).toBeDefined();
      expect(history.playerId).toBe('player1');
      expect(typeof history.challengesCompleted).toBe('number');
      expect(typeof history.averageScore).toBe('number');
    });
  });

  describe('ScoringSystem Tests', () => {
    test('should calculate multi-dimensional score correctly', async () => {
      const submission: ChallengeSubmission = {
        challengeId: 'test-challenge',
        playerId: 'player1',
        answer: { selectedOptions: ['correct'], reasoning: 'Excellent reasoning with evidence', confidenceLevel: 0.9 },
        confidence: 0.9,
        responseTime: 10000,
        submittedAt: new Date()
      };

      const context = {
        challengeId: 'test-challenge',
        type: 'bias_detection' as any,
        difficulty: 'intermediate' as any,
        correctAnswer: 'correct',
        timeLimit: 30000,
        complexity: 0.7,
        skills: ['bias_detection', 'critical_thinking']
      };

      const score = await scoringSystem.calculateScore(submission, context);

      expect(score.overall).toBeGreaterThan(0.7); // Should be high score for good submission
      expect(score.accuracy).toBe(1.0); // Correct answer
      expect(score.confidence).toBeGreaterThan(0.8); // Good confidence calibration
      expect(score.reasoning).toBeGreaterThan(0.8); // Good reasoning
      expect(score.speed).toBeGreaterThan(0.6); // Good speed
    });

    test('should handle incorrect answers appropriately', async () => {
      const submission: ChallengeSubmission = {
        challengeId: 'test-challenge',
        playerId: 'player1',
        answer: { selectedOptions: ['wrong'], reasoning: 'Poor reasoning', confidenceLevel: 0.9 },
        confidence: 0.9,
        responseTime: 25000,
        submittedAt: new Date()
      };

      const context = {
        challengeId: 'test-challenge',
        type: 'bias_detection' as any,
        difficulty: 'intermediate' as any,
        correctAnswer: 'correct',
        timeLimit: 30000,
        complexity: 0.7,
        skills: ['bias_detection']
      };

      const score = await scoringSystem.calculateScore(submission, context);

      expect(score.accuracy).toBe(0); // Incorrect answer
      expect(score.overall).toBeLessThan(0.5); // Should be low overall score
      expect(score.confidenceCalibration.overconfidencePenalty).toBeGreaterThan(0); // Overconfident
    });

    test('should adapt scoring weights based on player history', async () => {
      const playerHistory = {
        playerId: 'player1',
        totalChallenges: 10,
        averageScore: 0.6,
        strengths: ['speed'],
        weaknesses: ['accuracy'],
        skillProgression: new Map([['accuracy', 5], ['speed', 8]]),
        challengeTypeHistory: new Map(),
        confidenceCalibrationHistory: [],
        averageConfidenceCalibration: 0.5,
        totalExperience: 1000,
        lastUpdated: new Date()
      };

      // Mock the private method for testing
      const adaptiveWeights = await (scoringSystem as any).getAdaptiveWeights('player1', context, playerHistory);

      expect(adaptiveWeights.accuracy).toBeGreaterThan(0.4); // Should increase weight for weak area
      expect(adaptiveWeights.speed).toBeLessThan(0.2); // Should decrease weight for strong area
    });
  });

  describe('RealtimeService Tests', () => {
    test('should handle WebSocket connections', async () => {
      // Mock WebSocket connection
      const mockWs = {
        send: jest.fn(),
        on: jest.fn(),
        readyState: 1 // OPEN
      };

      const mockRequest = {
        headers: { 'user-agent': 'test-agent' }
      };

      // Test connection handling
      await realtimeService.start();

      const stats = realtimeService.getStatistics();
      expect(stats).toBeDefined();
      expect(typeof stats.totalConnections).toBe('number');
    });

    test('should broadcast challenge updates', async () => {
      const update = {
        challengeId: 'test-challenge',
        type: 'challenge_completed',
        data: { result: 'test' },
        timestamp: new Date(),
        affectedPlayers: ['player1', 'player2']
      };

      // Test broadcast functionality
      await expect(realtimeService.broadcastChallengeUpdate(update)).resolves.not.toThrow();
    });
  });

  describe('MobileAPI Tests', () => {
    test('should generate mobile-optimized challenge', async () => {
      const mockReq = {
        body: { challengeType: 'bias_detection', difficulty: 'beginner' },
        headers: { authorization: 'Bearer test-token' },
        deviceInfo: { type: 'mobile', os: 'iOS', osVersion: '15.0', screenWidth: 375, screenHeight: 667, pixelRatio: 2, capabilities: {} as any },
        networkInfo: { type: 'wifi' as any, downlink: 10, rtt: 50, saveData: false, effectiveType: '4g' as any },
        optimizationFlags: { compressedResponse: true, reducedQuality: false, skipAnimations: false, disableSounds: false, lowPowerMode: false }
      };

      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      };

      await mobileAPI.generateChallenge(mockReq as any, mockRes as any);

      expect(mockRes.json).toHaveBeenCalled();
      const responseData = mockRes.json.mock.calls[0][0];
      expect(responseData.data).toBeDefined();
      expect(responseData.metadata).toBeDefined();
      expect(responseData.optimizations).toBeDefined();
    });

    test('should submit challenge with mobile optimizations', async () => {
      const mockReq = {
        params: { challengeId: 'test-challenge' },
        body: {
          answer: { selectedOptions: ['option1'], reasoning: 'Test', confidenceLevel: 0.8 },
          confidence: 0.8,
          responseTime: 15000
        },
        headers: { authorization: 'Bearer test-token' },
        deviceInfo: { type: 'mobile' as any },
        networkInfo: { rtt: 100 },
        optimizationFlags: {}
      };

      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      };

      await mobileAPI.submitChallenge(mockReq as any, mockRes as any);

      expect(mockRes.json).toHaveBeenCalled();
    });

    test('should handle device detection correctly', async () => {
      const userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15';
      const deviceInfo = (mobileAPI as any).parseDeviceInfo(userAgent, {});

      expect(deviceInfo.type).toBe('mobile');
      expect(deviceInfo.os).toBe('iOS');
    });
  });

  describe('GachaSystem Tests', () => {
    test('should perform single gacha pull', async () => {
      const result = await gachaSystem.performPull('player1', 'single' as any);

      expect(result).toBeDefined();
      expect(result.pullId).toBeTruthy();
      expect(result.playerId).toBe('player1');
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.pullValue).toBeGreaterThan(0);
    });

    test('should perform multi-pull correctly', async () => {
      const result = await gachaSystem.performPull('player1', 'multi_10' as any);

      expect(result.items.length).toBe(10);
      expect(result.rarities.length).toBe(10);
    });

    test('should track player collection', async () => {
      const collection = await gachaSystem.getPlayerCollection('player1');

      expect(collection).toBeDefined();
      expect(collection.playerId).toBe('player1');
      expect(collection.items).toBeInstanceOf(Map);
    });

    test('should get available gacha packs', async () => {
      const packs = await gachaSystem.getAvailablePacks('player1');

      expect(Array.isArray(packs)).toBe(true);
      packs.forEach(pack => {
        expect(pack.id).toBeTruthy();
        expect(pack.name).toBeTruthy();
        expect(pack.cost).toBeGreaterThanOrEqual(0);
      });
    });

    test('should validate pull eligibility', async () => {
      // Test successful pull
      await expect(gachaSystem.performPull('player1', 'free_daily' as any)).resolves.toBeDefined();

      // Test invalid pull type
      await expect(gachaSystem.performPull('player1', 'invalid' as any)).rejects.toThrow();
    });
  });

  describe('Integration Tests', () => {
    test('should complete full challenge workflow', async () => {
      // 1. Generate challenge
      const challenge = await challengeEngine.generateChallenge('player1', 'bias_detection', 'beginner');
      expect(challenge.id).toBeTruthy();

      // 2. Submit answer
      const submission: ChallengeSubmission = {
        challengeId: challenge.id,
        playerId: 'player1',
        answer: { selectedOptions: ['option1'], reasoning: 'Test reasoning', confidenceLevel: 0.8 },
        confidence: 0.8,
        responseTime: 15000,
        submittedAt: new Date()
      };

      const result = await challengeEngine.submitChallengeAnswer(submission);
      expect(result.score.overall).toBeGreaterThanOrEqual(0);

      // 3. Perform gacha pull as reward
      const pullResult = await gachaSystem.performPull('player1', 'single' as any);
      expect(pullResult.items.length).toBeGreaterThan(0);

      // 4. Verify collection updated
      const collection = await gachaSystem.getPlayerCollection('player1');
      expect(collection.items.size).toBeGreaterThan(0);
    });

    test('should handle concurrent challenge submissions', async () => {
      const promises = [];

      for (let i = 0; i < 5; i++) {
        const submission: ChallengeSubmission = {
          challengeId: `challenge-${i}`,
          playerId: `player${i}`,
          answer: { selectedOptions: ['option1'], reasoning: `Test ${i}`, confidenceLevel: 0.8 },
          confidence: 0.8,
          responseTime: 10000 + i * 1000,
          submittedAt: new Date()
        };

        promises.push(challengeEngine.submitChallengeAnswer(submission));
      }

      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result.score).toBeDefined();
        expect(result.feedback).toBeDefined();
      });
    });

    test('should maintain performance under load', async () => {
      const startTime = Date.now();
      const promises = [];

      // Generate multiple challenges concurrently
      for (let i = 0; i < 10; i++) {
        promises.push(challengeEngine.generateChallenge(`player${i}`, 'bias_detection', 'beginner'));
      }

      const challenges = await Promise.all(promises);
      const endTime = Date.now();

      expect(challenges.length).toBe(10);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Error Handling Tests', () => {
    test('should handle invalid challenge submission', async () => {
      const invalidSubmission = {
        challengeId: 'nonexistent',
        playerId: 'player1',
        answer: { selectedOptions: [] },
        confidence: 0.5,
        responseTime: 1000,
        submittedAt: new Date()
      } as ChallengeSubmission;

      await expect(challengeEngine.submitChallengeAnswer(invalidSubmission))
        .rejects.toThrow();
    });

    test('should handle malformed mobile requests', async () => {
      const mockReq = {
        body: {},
        headers: {},
        deviceInfo: null,
        networkInfo: null
      };

      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      };

      await mobileAPI.generateChallenge(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    test('should handle real-time service errors gracefully', async () => {
      const invalidUpdate = {
        challengeId: '',
        type: 'invalid',
        data: null,
        timestamp: new Date(),
        affectedPlayers: []
      };

      await expect(realtimeService.broadcastChallengeUpdate(invalidUpdate))
        .resolves.not.toThrow();
    });
  });

  describe('Performance Tests', () => {
    test('should meet challenge generation performance target', async () => {
      const startTime = Date.now();

      await challengeEngine.generateChallenge('player1', 'bias_detection', 'beginner');

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // Should be under 100ms
    });

    test('should meet challenge submission performance target', async () => {
      const submission: ChallengeSubmission = {
        challengeId: 'test-challenge',
        playerId: 'player1',
        answer: { selectedOptions: ['option1'], reasoning: 'Test', confidenceLevel: 0.8 },
        confidence: 0.8,
        responseTime: 10000,
        submittedAt: new Date()
      };

      const startTime = Date.now();

      await challengeEngine.submitChallengeAnswer(submission);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(50); // Should be under 50ms
    });

    test('should handle mobile API response time target', async () => {
      const mockReq = {
        body: { challengeType: 'bias_detection' },
        headers: { authorization: 'Bearer test' },
        deviceInfo: { type: 'mobile' as any },
        networkInfo: {},
        optimizationFlags: {}
      };

      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      };

      const startTime = Date.now();

      await mobileAPI.generateChallenge(mockReq as any, mockRes as any);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(200); // Should be under 200ms
    });
  });

  describe('Scalability Tests', () => {
    test('should handle multiple concurrent users', async () => {
      const userPromises = [];

      for (let i = 0; i < 50; i++) {
        userPromises.push(
          challengeEngine.generateChallenge(`player${i}`, 'bias_detection', 'beginner')
        );
      }

      const results = await Promise.all(userPromises);

      expect(results.length).toBe(50);
      results.forEach(result => {
        expect(result.id).toBeTruthy();
      });
    });

    test('should maintain performance with many active challenges', async () => {
      const challengePromises = [];

      for (let i = 0; i < 20; i++) {
        challengePromises.push(
          challengeEngine.generateChallenge(`player${i}`, 'bias_detection', 'beginner')
        );
      }

      const startTime = Date.now();
      const challenges = await Promise.all(challengePromises);
      const endTime = Date.now();

      expect(challenges.length).toBe(20);
      expect(endTime - startTime).toBeLessThan(3000); // Should handle 20 challenges in under 3 seconds
    });
  });

  // Helper functions
  async function setupTestData(): Promise<void> {
    // Setup mock data for testing
    const mockChallenge: Challenge = {
      id: 'test-challenge',
      type: 'bias_detection' as any,
      difficulty: 'intermediate' as any,
      content: {
        prompt: 'Test challenge prompt',
        options: [
          { id: 'option1', text: 'Correct answer', isCorrect: true, explanation: 'This is correct' },
          { id: 'option2', text: 'Wrong answer', isCorrect: false, explanation: 'This is wrong' }
        ],
        timeLimit: 30000
      },
      metadata: {
        tags: ['ai', 'bias'],
        skills: ['bias_detection'],
        aiModelUsed: 'test-model',
        estimatedDuration: 120,
        difficultyFactors: { complexity: 0.7, knowledgeRequired: ['ai_basics'], criticalThinking: 0.8, researchIntensity: 0.3, ethicalConsiderations: 0.2 }
      },
      state: 'active' as any,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 300000),
      maxParticipants: 1,
      currentParticipants: 1
    };

    // Mock the challenge engine to return test challenge
    jest.spyOn(challengeEngine, 'getChallenge').mockResolvedValue(mockChallenge);
  }
});

// Test utilities and mocks
export class TestUtils {
  static createMockChallengeSubmission(overrides: Partial<ChallengeSubmission> = {}): ChallengeSubmission {
    return {
      challengeId: 'test-challenge',
      playerId: 'test-player',
      answer: { selectedOptions: ['option1'], reasoning: 'Test reasoning', confidenceLevel: 0.8 },
      confidence: 0.8,
      responseTime: 15000,
      submittedAt: new Date(),
      ...overrides
    };
  }

  static createMockChallenge(overrides: Partial<Challenge> = {}): Challenge {
    return {
      id: 'test-challenge',
      type: 'bias_detection' as any,
      difficulty: 'intermediate' as any,
      content: { prompt: 'Test prompt', options: [] },
      metadata: { tags: [], skills: [], aiModelUsed: 'test', estimatedDuration: 120, difficultyFactors: {} as any },
      state: 'active' as any,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 300000),
      maxParticipants: 1,
      currentParticipants: 1,
      ...overrides
    };
  }

  static createMockDeviceInfo(type: 'mobile' | 'tablet' | 'desktop' = 'mobile'): any {
    return {
      type,
      os: 'iOS',
      osVersion: '15.0',
      screenWidth: 375,
      screenHeight: 667,
      pixelRatio: 2,
      capabilities: {
        maxTextureSize: 2048,
        supportedFormats: ['jpg', 'png'],
        hasWebGL: true,
        memoryLimit: 256,
        cpuCores: 4
      }
    };
  }
}

// Performance benchmarking utilities
export class PerformanceBenchmark {
  static async measureAsyncOperation<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<{ result: T; duration: number }> {
    const startTime = Date.now();
    const result = await operation();
    const duration = Date.now() - startTime;

    console.log(`${operationName}: ${duration}ms`);
    return { result, duration };
  }

  static validatePerformanceTarget(duration: number, target: number, operation: string): void {
    if (duration > target) {
      console.warn(`Performance target not met for ${operation}: ${duration}ms > ${target}ms`);
    } else {
      console.log(`✓ ${operation} met performance target: ${duration}ms <= ${target}ms`);
    }
  }
}

// Mock implementations for testing
export class MockWebSocket {
  send = jest.fn();
  on = jest.fn();
  readyState = 1; // OPEN
  ping = jest.fn();
  close = jest.fn();
}

export class MockRealtimeService {
  broadcastChallengeUpdate = jest.fn().mockResolvedValue(undefined);
  getStatistics = jest.fn().mockReturnValue({
    totalConnections: 10,
    activeConnections: 8,
    averageLatency: 50,
    mobileConnections: 6
  });
}

// Test configuration
export const TEST_CONFIG = {
  performanceTargets: {
    challengeGeneration: 100, // ms
    challengeSubmission: 50, // ms
    mobileAPIResponse: 200, // ms
    realtimeBroadcast: 10 // ms
  },
  scalabilityTargets: {
    concurrentUsers: 100,
    activeChallenges: 50,
    realtimeConnections: 100
  }
};