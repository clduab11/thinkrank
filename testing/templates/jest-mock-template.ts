/**
 * London School TDD Mock Template
 * Template for creating comprehensive mocks with behavior verification
 */

import { jest } from '@jest/globals';

// Example: Service with Dependencies Mock Template
export class ServiceMockTemplate {
  /**
   * Creates a fully mocked service with all dependencies
   * Following London School principle of mocking all collaborators
   */
  static createAuthServiceMocks() {
    // Repository mocks - Data layer collaborators
    const mockUserRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      exists: jest.fn(),
    } as jest.Mocked<UserRepository>;

    // External service mocks - Infrastructure collaborators
    const mockTokenService = {
      generateAccessToken: jest.fn(),
      generateRefreshToken: jest.fn(),
      verifyToken: jest.fn(),
      revokeToken: jest.fn(),
      getTokenExpiry: jest.fn(),
    } as jest.Mocked<TokenService>;

    const mockEmailService = {
      sendVerificationEmail: jest.fn(),
      sendPasswordResetEmail: jest.fn(),
      sendWelcomeEmail: jest.fn(),
      sendSecurityAlert: jest.fn(),
    } as jest.Mocked<EmailService>;

    const mockCryptoService = {
      hashPassword: jest.fn(),
      comparePassword: jest.fn(),
      generateSalt: jest.fn(),
      generateSecureToken: jest.fn(),
    } as jest.Mocked<CryptoService>;

    // Logging and monitoring mocks - Cross-cutting concerns
    const mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      child: jest.fn().mockReturnThis(),
    } as jest.Mocked<Logger>;

    const mockMetrics = {
      increment: jest.fn(),
      timing: jest.fn(),
      gauge: jest.fn(),
      histogram: jest.fn(),
    } as jest.Mocked<MetricsCollector>;

    // Cache service mock - Performance layer
    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      exists: jest.fn(),
      flush: jest.fn(),
    } as jest.Mocked<CacheService>;

    return {
      mockUserRepository,
      mockTokenService,
      mockEmailService,
      mockCryptoService,
      mockLogger,
      mockMetrics,
      mockCacheService,
    };
  }

  /**
   * Sets up default mock behaviors for common scenarios
   * London School: Define collaborator contracts through mocks
   */
  static setupDefaultBehaviors(mocks: ReturnType<typeof ServiceMockTemplate.createAuthServiceMocks>) {
    const { 
      mockUserRepository, 
      mockTokenService, 
      mockEmailService, 
      mockCryptoService,
      mockLogger,
      mockCacheService 
    } = mocks;

    // Default successful behaviors
    mockUserRepository.save.mockImplementation(async (user) => ({
      ...user,
      id: 'generated-id',
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    mockTokenService.generateAccessToken.mockReturnValue('mock-access-token');
    mockTokenService.generateRefreshToken.mockReturnValue('mock-refresh-token');
    mockTokenService.verifyToken.mockResolvedValue({ valid: true, userId: 'user-123' });

    mockCryptoService.hashPassword.mockResolvedValue('hashed-password');
    mockCryptoService.comparePassword.mockResolvedValue(true);

    mockEmailService.sendVerificationEmail.mockResolvedValue(true);
    mockEmailService.sendWelcomeEmail.mockResolvedValue(true);

    mockCacheService.get.mockResolvedValue(null); // Cache miss by default
    mockCacheService.set.mockResolvedValue(true);

    // Logger should always succeed
    mockLogger.child.mockReturnValue(mockLogger);

    return mocks;
  }

  /**
   * Creates interaction verification helpers
   * London School: Focus on how objects collaborate
   */
  static createInteractionVerifiers(mocks: ReturnType<typeof ServiceMockTemplate.createAuthServiceMocks>) {
    return {
      verifyUserRegistrationWorkflow: (userData: any) => {
        const { mockUserRepository, mockTokenService, mockEmailService, mockLogger } = mocks;
        
        // Verify the conversation sequence
        expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(userData.email);
        expect(mockUserRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({ email: userData.email })
        );
        expect(mockTokenService.generateAccessToken).toHaveBeenCalledWith(
          expect.objectContaining({ email: userData.email })
        );
        expect(mockEmailService.sendVerificationEmail).toHaveBeenCalledWith(
          expect.any(String),
          userData.email
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          'User registered successfully',
          expect.any(Object)
        );
      },

      verifyLoginWorkflow: (credentials: any) => {
        const { mockUserRepository, mockCryptoService, mockTokenService, mockLogger } = mocks;
        
        expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(credentials.email);
        expect(mockCryptoService.comparePassword).toHaveBeenCalledWith(
          credentials.password,
          expect.any(String)
        );
        expect(mockTokenService.generateAccessToken).toHaveBeenCalled();
        expect(mockLogger.info).toHaveBeenCalledWith(
          'User logged in successfully',
          expect.objectContaining({ email: credentials.email })
        );
      },

      verifyPasswordResetWorkflow: (email: string) => {
        const { mockUserRepository, mockTokenService, mockEmailService, mockLogger } = mocks;
        
        expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(email);
        expect(mockTokenService.generateSecureToken).toHaveBeenCalled();
        expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalledWith(
          email,
          expect.any(String)
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Password reset initiated',
          expect.objectContaining({ email })
        );
      },

      verifyCallOrder: (expectedCalls: string[]) => {
        const allCalls = jest.getAllMockCalls();
        const callNames = allCalls.map(call => call[0]);
        
        expectedCalls.forEach((expectedCall, index) => {
          expect(callNames[index]).toBe(expectedCall);
        });
      },

      verifyNoUnexpectedCalls: () => {
        const { 
          mockUserRepository, 
          mockTokenService, 
          mockEmailService, 
          mockCryptoService 
        } = mocks;
        
        // Ensure no methods were called that shouldn't have been
        expect(mockUserRepository.delete).not.toHaveBeenCalled();
        expect(mockTokenService.revokeToken).not.toHaveBeenCalled();
        expect(mockEmailService.sendSecurityAlert).not.toHaveBeenCalled();
      },
    };
  }

  /**
   * Creates error scenario setups
   * London School: Test error handling through collaborator failures
   */
  static setupErrorScenarios(mocks: ReturnType<typeof ServiceMockTemplate.createAuthServiceMocks>) {
    const { 
      mockUserRepository, 
      mockTokenService, 
      mockEmailService, 
      mockCryptoService 
    } = mocks;

    return {
      userAlreadyExists: () => {
        mockUserRepository.findByEmail.mockResolvedValue({
          id: 'existing-user',
          email: 'existing@example.com',
        } as any);
      },

      databaseError: () => {
        mockUserRepository.save.mockRejectedValue(new Error('Database connection failed'));
      },

      emailServiceError: () => {
        mockEmailService.sendVerificationEmail.mockRejectedValue(
          new Error('Email service unavailable')
        );
      },

      tokenServiceError: () => {
        mockTokenService.generateAccessToken.mockImplementation(() => {
          throw new Error('Token generation failed');
        });
      },

      cryptoServiceError: () => {
        mockCryptoService.hashPassword.mockRejectedValue(
          new Error('Crypto operation failed')
        );
      },

      invalidCredentials: () => {
        mockUserRepository.findByEmail.mockResolvedValue(null);
        mockCryptoService.comparePassword.mockResolvedValue(false);
      },
    };
  }
}

// Unity Mock Template for C# Components
export const UnityMockTemplate = `
using NSubstitute;
using UnityEngine;
using UnityEngine.TestTools;
using NUnit.Framework;

/// <summary>
/// Unity Mock Template following London School TDD principles
/// </summary>
public class UnityMockTemplate
{
    /// <summary>
    /// Creates comprehensive mocks for GameManager dependencies
    /// </summary>
    public static GameManagerMocks CreateGameManagerMocks()
    {
        return new GameManagerMocks
        {
            MockAPIManager = Substitute.For<IAPIManager>(),
            MockUIManager = Substitute.For<IUIManager>(),
            MockPerformanceManager = Substitute.For<IPerformanceManager>(),
            MockPlayerDataManager = Substitute.For<IPlayerDataManager>(),
            MockAudioManager = Substitute.For<IAudioManager>(),
            MockInputManager = Substitute.For<IInputManager>(),
            MockLogger = Substitute.For<ILogger>(),
            MockMetrics = Substitute.For<IMetricsCollector>(),
        };
    }

    /// <summary>
    /// Sets up default mock behaviors for successful scenarios
    /// </summary>
    public static void SetupDefaultBehaviors(GameManagerMocks mocks)
    {
        // API Manager defaults
        mocks.MockAPIManager.FetchGameProblem(Arg.Any<int>())
            .Returns(Task.FromResult(new ResearchProblem { Id = "problem-123" }));
        mocks.MockAPIManager.SubmitAnswer(Arg.Any<string>(), Arg.Any<string>())
            .Returns(Task.FromResult(new SubmitResult { Success = true, Score = 100 }));

        // UI Manager defaults
        mocks.MockUIManager.ShowLoadingScreen().Returns(true);
        mocks.MockUIManager.TransitionToGameScreen().Returns(true);
        mocks.MockUIManager.UpdateScore(Arg.Any<int>()).Returns(true);

        // Player Data defaults
        mocks.MockPlayerDataManager.GetCurrentPlayer()
            .Returns(new PlayerData { PlayerId = "player-123", Level = 5 });
        mocks.MockPlayerDataManager.SaveProgress(Arg.Any<GameProgress>())
            .Returns(Task.FromResult(true));

        // Performance Manager defaults
        mocks.MockPerformanceManager.GetCurrentMetrics()
            .Returns(new PerformanceMetrics { FPS = 60, MemoryUsage = 256 });

        // Audio Manager defaults
        mocks.MockAudioManager.PlaySound(Arg.Any<string>()).Returns(true);
        mocks.MockAudioManager.SetVolume(Arg.Any<float>()).Returns(true);
    }

    /// <summary>
    /// Creates interaction verification helpers for Unity components
    /// </summary>
    public static UnityInteractionVerifiers CreateVerifiers(GameManagerMocks mocks)
    {
        return new UnityInteractionVerifiers(mocks);
    }
}

public class GameManagerMocks
{
    public IAPIManager MockAPIManager { get; set; }
    public IUIManager MockUIManager { get; set; }
    public IPerformanceManager MockPerformanceManager { get; set; }
    public IPlayerDataManager MockPlayerDataManager { get; set; }
    public IAudioManager MockAudioManager { get; set; }
    public IInputManager MockInputManager { get; set; }
    public ILogger MockLogger { get; set; }
    public IMetricsCollector MockMetrics { get; set; }
}

public class UnityInteractionVerifiers
{
    private readonly GameManagerMocks _mocks;

    public UnityInteractionVerifiers(GameManagerMocks mocks)
    {
        _mocks = mocks;
    }

    public void VerifyGameStartWorkflow()
    {
        Received.InOrder(() =>
        {
            _mocks.MockUIManager.ShowLoadingScreen();
            _mocks.MockPlayerDataManager.GetCurrentPlayer();
            _mocks.MockAPIManager.FetchGameProblem(Arg.Any<int>());
            _mocks.MockPerformanceManager.StartPerformanceTracking();
            _mocks.MockUIManager.TransitionToGameScreen();
        });
    }

    public void VerifyAnswerSubmissionWorkflow(string problemId, string answer)
    {
        _mocks.MockAPIManager.Received(1).SubmitAnswer(problemId, answer);
        _mocks.MockUIManager.Received(1).UpdateScore(Arg.Any<int>());
        _mocks.MockPlayerDataManager.Received(1).SaveProgress(Arg.Any<GameProgress>());
        _mocks.MockLogger.Received(1).LogInfo("Answer submitted", Arg.Any<object>());
    }

    public void VerifyErrorHandlingWorkflow()
    {
        _mocks.MockLogger.Received(1).LogError(Arg.Any<string>(), Arg.Any<System.Exception>());
        _mocks.MockUIManager.Received(1).ShowError(Arg.Any<string>());
        _mocks.MockPerformanceManager.Received(1).StopPerformanceTracking();
    }
}
`;

// Integration Test Mock Template
export class IntegrationMockTemplate {
  /**
   * Creates mocks for integration testing with external services
   */
  static createExternalServiceMocks() {
    return {
      // Supabase client mock
      mockSupabaseClient: {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn(),
        data: null,
        error: null,
      } as any,

      // Redis client mock
      mockRedisClient: {
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
        exists: jest.fn(),
        expire: jest.fn(),
        flushall: jest.fn(),
      } as jest.Mocked<RedisClient>,

      // Stripe mock
      mockStripe: {
        customers: {
          create: jest.fn(),
          retrieve: jest.fn(),
          update: jest.fn(),
        },
        subscriptions: {
          create: jest.fn(),
          update: jest.fn(),
          cancel: jest.fn(),
        },
        paymentIntents: {
          create: jest.fn(),
          confirm: jest.fn(),
        },
      } as any,

      // AWS SDK mocks
      mockS3: {
        upload: jest.fn().mockReturnThis(),
        promise: jest.fn(),
        getObject: jest.fn().mockReturnThis(),
        deleteObject: jest.fn().mockReturnThis(),
      } as any,

      // Firebase mock
      mockFirebase: {
        auth: {
          verifyIdToken: jest.fn(),
          createCustomToken: jest.fn(),
        },
        messaging: {
          send: jest.fn(),
          sendMulticast: jest.fn(),
        },
        analytics: {
          logEvent: jest.fn(),
        },
      } as any,
    };
  }

  /**
   * Sets up contract-based mocking for API integration tests
   */
  static setupAPIContractMocks() {
    return {
      authServiceContract: {
        'POST /api/auth/register': {
          request: {
            body: { email: 'string', password: 'string' },
            headers: { 'Content-Type': 'application/json' },
          },
          response: {
            status: 201,
            body: {
              success: true,
              user: { id: 'string', email: 'string' },
              tokens: { accessToken: 'string', refreshToken: 'string' },
            },
          },
        },
        'POST /api/auth/login': {
          request: {
            body: { email: 'string', password: 'string' },
          },
          response: {
            status: 200,
            body: {
              success: true,
              tokens: { accessToken: 'string', refreshToken: 'string' },
            },
          },
        },
      },

      gameServiceContract: {
        'GET /api/game/problems/:level': {
          request: {
            params: { level: 'number' },
            headers: { Authorization: 'Bearer string' },
          },
          response: {
            status: 200,
            body: {
              problem: {
                id: 'string',
                title: 'string',
                description: 'string',
                options: ['string'],
                difficulty: 'string',
              },
            },
          },
        },
        'POST /api/game/submit-answer': {
          request: {
            body: { problemId: 'string', answer: 'string', timeSpent: 'number' },
            headers: { Authorization: 'Bearer string' },
          },
          response: {
            status: 200,
            body: {
              correct: 'boolean',
              score: 'number',
              explanation: 'string',
            },
          },
        },
      },
    };
  }
}

// Type definitions for mocks
interface UserRepository {
  findById(id: string): Promise<any>;
  findByEmail(email: string): Promise<any>;
  save(user: any): Promise<any>;
  update(id: string, data: any): Promise<any>;
  delete(id: string): Promise<boolean>;
  exists(id: string): Promise<boolean>;
}

interface TokenService {
  generateAccessToken(user: any): string;
  generateRefreshToken(user: any): string;
  verifyToken(token: string): Promise<any>;
  revokeToken(token: string): Promise<boolean>;
  getTokenExpiry(token: string): Date;
  generateSecureToken(): string;
}

interface EmailService {
  sendVerificationEmail(userId: string, email: string): Promise<boolean>;
  sendPasswordResetEmail(email: string, token: string): Promise<boolean>;
  sendWelcomeEmail(email: string): Promise<boolean>;
  sendSecurityAlert(email: string, details: any): Promise<boolean>;
}

interface CryptoService {
  hashPassword(password: string): Promise<string>;
  comparePassword(password: string, hash: string): Promise<boolean>;
  generateSalt(): string;
  generateSecureToken(): string;
}

interface Logger {
  info(message: string, meta?: any): void;
  error(message: string, error?: Error): void;
  warn(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
  child(meta: any): Logger;
}

interface MetricsCollector {
  increment(metric: string, value?: number): void;
  timing(metric: string, value: number): void;
  gauge(metric: string, value: number): void;
  histogram(metric: string, value: number): void;
}

interface CacheService {
  get(key: string): Promise<any>;
  set(key: string, value: any, ttl?: number): Promise<boolean>;
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
  flush(): Promise<boolean>;
}

interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<string>;
  del(key: string): Promise<number>;
  exists(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  flushall(): Promise<string>;
}