/**
 * London School TDD Example: AuthService
 * Demonstrates behavior verification and extensive mocking
 */

import { AuthService } from '../src/services/auth.service';
import { ServiceMockTemplate } from '../templates/jest-mock-template';
import { jest } from '@jest/globals';

describe('AuthService - London School TDD', () => {
  let authService: AuthService;
  let mocks: ReturnType<typeof ServiceMockTemplate.createAuthServiceMocks>;
  let verifiers: ReturnType<typeof ServiceMockTemplate.createInteractionVerifiers>;
  let errorScenarios: ReturnType<typeof ServiceMockTemplate.setupErrorScenarios>;

  beforeEach(() => {
    // Create all mocks - London School: Mock everything
    mocks = ServiceMockTemplate.createAuthServiceMocks();
    ServiceMockTemplate.setupDefaultBehaviors(mocks);

    // Create verification helpers
    verifiers = ServiceMockTemplate.createInteractionVerifiers(mocks);
    errorScenarios = ServiceMockTemplate.setupErrorScenarios(mocks);

    // Inject all dependencies as mocks
    authService = new AuthService(
      mocks.mockUserRepository,
      mocks.mockTokenService,
      mocks.mockEmailService,
      mocks.mockCryptoService,
      mocks.mockLogger,
      mocks.mockMetrics,
      mocks.mockCacheService
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('registerUser', () => {
    const validUserData = {
      email: 'test@example.com',
      password: 'SecurePass123!',
      firstName: 'Test',
      lastName: 'User',
    };

    describe('successful registration workflow', () => {
      it('should orchestrate the complete registration workflow correctly', async () => {
        // Arrange - Set up mock expectations
        const expectedUser = {
          id: 'user-123',
          email: validUserData.email,
          firstName: validUserData.firstName,
          lastName: validUserData.lastName,
          verified: false,
          createdAt: new Date(),
        };

        mocks.mockUserRepository.findByEmail.mockResolvedValue(null);
        mocks.mockUserRepository.save.mockResolvedValue(expectedUser);
        mocks.mockCryptoService.hashPassword.mockResolvedValue('hashed-password');
        mocks.mockTokenService.generateAccessToken.mockReturnValue('access-token-123');
        mocks.mockTokenService.generateRefreshToken.mockReturnValue('refresh-token-456');
        mocks.mockEmailService.sendVerificationEmail.mockResolvedValue(true);

        // Act
        const result = await authService.registerUser(validUserData);

        // Assert - London School: Verify the conversation between objects
        expect(result.success).toBe(true);
        expect(result.user.email).toBe(validUserData.email);

        // Verify the complete workflow interactions
        verifiers.verifyUserRegistrationWorkflow(validUserData);

        // Verify metrics collection
        expect(mocks.mockMetrics.increment).toHaveBeenCalledWith('auth.registration.attempt');
        expect(mocks.mockMetrics.increment).toHaveBeenCalledWith('auth.registration.success');

        // Verify cache operations
        expect(mocks.mockCacheService.set).toHaveBeenCalledWith(
          `user:${expectedUser.id}`,
          expectedUser,
          3600 // 1 hour TTL
        );

        // Verify no unexpected calls
        verifiers.verifyNoUnexpectedCalls();
      });

      it('should handle password hashing with proper security measures', async () => {
        // Arrange
        mocks.mockUserRepository.findByEmail.mockResolvedValue(null);
        mocks.mockCryptoService.hashPassword.mockResolvedValue('secure-hash');

        // Act
        await authService.registerUser(validUserData);

        // Assert - Verify security collaboration
        expect(mocks.mockCryptoService.hashPassword).toHaveBeenCalledWith(validUserData.password);
        expect(mocks.mockUserRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({
            passwordHash: 'secure-hash',
            // Ensure password is not stored in plain text
            password: undefined,
          })
        );

        // Verify security logging
        expect(mocks.mockLogger.info).toHaveBeenCalledWith(
          'Password hashed successfully',
          expect.objectContaining({ userId: expect.any(String) })
        );
      });

      it('should verify the exact order of operations during registration', async () => {
        // Arrange
        mocks.mockUserRepository.findByEmail.mockResolvedValue(null);

        // Act
        await authService.registerUser(validUserData);

        // Assert - London School: Verify call sequence is critical
        const expectedCallOrder = [
          'mockUserRepository.findByEmail',
          'mockCryptoService.hashPassword',
          'mockUserRepository.save',
          'mockTokenService.generateAccessToken',
          'mockTokenService.generateRefreshToken',
          'mockEmailService.sendVerificationEmail',
        ];

        verifiers.verifyCallOrder(expectedCallOrder);
      });
    });

    describe('error handling scenarios', () => {
      it('should handle duplicate email registration gracefully', async () => {
        // Arrange
        errorScenarios.userAlreadyExists();

        // Act & Assert
        await expect(authService.registerUser(validUserData)).rejects.toThrow(
          'User with this email already exists'
        );

        // Verify error handling workflow
        expect(mocks.mockUserRepository.findByEmail).toHaveBeenCalledWith(validUserData.email);
        expect(mocks.mockMetrics.increment).toHaveBeenCalledWith('auth.registration.error.duplicate_email');
        expect(mocks.mockLogger.warn).toHaveBeenCalledWith(
          'Registration attempt with existing email',
          expect.objectContaining({ email: validUserData.email })
        );

        // Verify no unnecessary operations occurred
        expect(mocks.mockCryptoService.hashPassword).not.toHaveBeenCalled();
        expect(mocks.mockUserRepository.save).not.toHaveBeenCalled();
        expect(mocks.mockEmailService.sendVerificationEmail).not.toHaveBeenCalled();
      });

      it('should handle database errors during user save', async () => {
        // Arrange
        errorScenarios.databaseError();
        mocks.mockUserRepository.findByEmail.mockResolvedValue(null);

        // Act & Assert
        await expect(authService.registerUser(validUserData)).rejects.toThrow(
          'Database connection failed'
        );

        // Verify error handling
        expect(mocks.mockLogger.error).toHaveBeenCalledWith(
          'User registration failed',
          expect.any(Error)
        );
        expect(mocks.mockMetrics.increment).toHaveBeenCalledWith('auth.registration.error.database');

        // Verify cleanup operations
        expect(mocks.mockEmailService.sendVerificationEmail).not.toHaveBeenCalled();
        expect(mocks.mockTokenService.generateAccessToken).not.toHaveBeenCalled();
      });

      it('should handle email service failures gracefully', async () => {
        // Arrange
        mocks.mockUserRepository.findByEmail.mockResolvedValue(null);
        errorScenarios.emailServiceError();

        // Act & Assert
        await expect(authService.registerUser(validUserData)).rejects.toThrow(
          'Email service unavailable'
        );

        // Verify partial completion handling
        expect(mocks.mockUserRepository.save).toHaveBeenCalled();
        expect(mocks.mockLogger.error).toHaveBeenCalledWith(
          'Failed to send verification email',
          expect.any(Error)
        );
        expect(mocks.mockMetrics.increment).toHaveBeenCalledWith('auth.registration.error.email_service');

        // In a real scenario, might want to verify rollback operations
        // This is where London School shines - testing the error handling conversation
      });
    });

    describe('security validations', () => {
      it('should validate password complexity requirements', async () => {
        // Arrange
        const weakPasswordData = { ...validUserData, password: '123' };

        // Act & Assert
        await expect(authService.registerUser(weakPasswordData)).rejects.toThrow(
          'Password does not meet complexity requirements'
        );

        // Verify security validation workflow
        expect(mocks.mockLogger.warn).toHaveBeenCalledWith(
          'Password complexity validation failed',
          expect.objectContaining({ email: weakPasswordData.email })
        );
        expect(mocks.mockMetrics.increment).toHaveBeenCalledWith('auth.registration.error.weak_password');

        // Verify no sensitive operations occurred
        expect(mocks.mockCryptoService.hashPassword).not.toHaveBeenCalled();
        expect(mocks.mockUserRepository.save).not.toHaveBeenCalled();
      });

      it('should validate email format before processing', async () => {
        // Arrange
        const invalidEmailData = { ...validUserData, email: 'invalid-email' };

        // Act & Assert
        await expect(authService.registerUser(invalidEmailData)).rejects.toThrow(
          'Invalid email format'
        );

        // Verify validation workflow
        expect(mocks.mockLogger.warn).toHaveBeenCalledWith(
          'Email format validation failed',
          expect.objectContaining({ email: invalidEmailData.email })
        );

        // Verify no database operations occurred
        expect(mocks.mockUserRepository.findByEmail).not.toHaveBeenCalled();
      });
    });
  });

  describe('loginUser', () => {
    const validCredentials = {
      email: 'test@example.com',
      password: 'SecurePass123!',
    };

    describe('successful login workflow', () => {
      it('should orchestrate the complete login workflow correctly', async () => {
        // Arrange
        const existingUser = {
          id: 'user-123',
          email: validCredentials.email,
          passwordHash: 'stored-hash',
          verified: true,
        };

        mocks.mockUserRepository.findByEmail.mockResolvedValue(existingUser);
        mocks.mockCryptoService.comparePassword.mockResolvedValue(true);
        mocks.mockTokenService.generateAccessToken.mockReturnValue('new-access-token');
        mocks.mockTokenService.generateRefreshToken.mockReturnValue('new-refresh-token');

        // Act
        const result = await authService.loginUser(validCredentials);

        // Assert
        expect(result.success).toBe(true);
        expect(result.tokens.accessToken).toBe('new-access-token');

        // Verify login workflow
        verifiers.verifyLoginWorkflow(validCredentials);

        // Verify cache operations for session management
        expect(mocks.mockCacheService.set).toHaveBeenCalledWith(
          `session:user-123`,
          expect.objectContaining({
            userId: 'user-123',
            loginTime: expect.any(Date),
          }),
          86400 // 24 hour session
        );

        // Verify metrics
        expect(mocks.mockMetrics.increment).toHaveBeenCalledWith('auth.login.success');
        expect(mocks.mockMetrics.timing).toHaveBeenCalledWith(
          'auth.login.duration',
          expect.any(Number)
        );
      });

      it('should handle password verification securely', async () => {
        // Arrange
        const existingUser = {
          id: 'user-123',
          email: validCredentials.email,
          passwordHash: 'stored-hash',
        };

        mocks.mockUserRepository.findByEmail.mockResolvedValue(existingUser);
        mocks.mockCryptoService.comparePassword.mockResolvedValue(true);

        // Act
        await authService.loginUser(validCredentials);

        // Assert - Verify secure password handling
        expect(mocks.mockCryptoService.comparePassword).toHaveBeenCalledWith(
          validCredentials.password,
          'stored-hash'
        );

        // Verify password is not logged or cached
        expect(mocks.mockLogger.info).not.toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ password: validCredentials.password })
        );
      });
    });

    describe('authentication failures', () => {
      it('should handle non-existent user login attempts', async () => {
        // Arrange
        mocks.mockUserRepository.findByEmail.mockResolvedValue(null);

        // Act & Assert
        await expect(authService.loginUser(validCredentials)).rejects.toThrow(
          'Invalid credentials'
        );

        // Verify security workflow
        expect(mocks.mockLogger.warn).toHaveBeenCalledWith(
          'Login attempt with non-existent email',
          expect.objectContaining({ 
            email: validCredentials.email,
            ip: expect.any(String) // Should log IP for security
          })
        );
        expect(mocks.mockMetrics.increment).toHaveBeenCalledWith('auth.login.error.invalid_user');

        // Verify no password comparison occurred
        expect(mocks.mockCryptoService.comparePassword).not.toHaveBeenCalled();
      });

      it('should handle invalid password attempts', async () => {
        // Arrange
        const existingUser = { id: 'user-123', email: validCredentials.email };
        mocks.mockUserRepository.findByEmail.mockResolvedValue(existingUser);
        mocks.mockCryptoService.comparePassword.mockResolvedValue(false);

        // Act & Assert
        await expect(authService.loginUser(validCredentials)).rejects.toThrow(
          'Invalid credentials'
        );

        // Verify security monitoring
        expect(mocks.mockLogger.warn).toHaveBeenCalledWith(
          'Invalid password attempt',
          expect.objectContaining({ 
            userId: 'user-123',
            email: validCredentials.email 
          })
        );
        expect(mocks.mockMetrics.increment).toHaveBeenCalledWith('auth.login.error.invalid_password');

        // Verify no tokens were generated
        expect(mocks.mockTokenService.generateAccessToken).not.toHaveBeenCalled();
        expect(mocks.mockTokenService.generateRefreshToken).not.toHaveBeenCalled();
      });
    });
  });

  describe('resetPassword', () => {
    const resetEmail = 'test@example.com';

    it('should orchestrate password reset workflow correctly', async () => {
      // Arrange
      const existingUser = { id: 'user-123', email: resetEmail };
      mocks.mockUserRepository.findByEmail.mockResolvedValue(existingUser);
      mocks.mockTokenService.generateSecureToken.mockReturnValue('reset-token-123');

      // Act
      const result = await authService.resetPassword(resetEmail);

      // Assert
      expect(result.success).toBe(true);

      // Verify password reset workflow
      verifiers.verifyPasswordResetWorkflow(resetEmail);

      // Verify secure token storage
      expect(mocks.mockCacheService.set).toHaveBeenCalledWith(
        `password-reset:reset-token-123`,
        'user-123',
        1800 // 30 minute expiry
      );

      // Verify security logging
      expect(mocks.mockLogger.info).toHaveBeenCalledWith(
        'Password reset initiated',
        expect.objectContaining({ 
          email: resetEmail,
          userId: 'user-123' 
        })
      );
    });
  });

  describe('complex interaction scenarios', () => {
    it('should handle concurrent registration attempts gracefully', async () => {
      // This test demonstrates London School's strength in testing complex interactions
      // Arrange
      const userData1 = { ...validUserData, email: 'concurrent1@example.com' };
      const userData2 = { ...validUserData, email: 'concurrent2@example.com' };

      // Simulate race condition
      mocks.mockUserRepository.findByEmail
        .mockResolvedValueOnce(null) // First call succeeds
        .mockResolvedValueOnce(null); // Second call also succeeds

      // But save fails for second due to unique constraint
      mocks.mockUserRepository.save
        .mockResolvedValueOnce({ id: 'user-1', email: userData1.email })
        .mockRejectedValueOnce(new Error('Unique constraint violation'));

      // Act
      const [result1, result2] = await Promise.allSettled([
        authService.registerUser(userData1),
        authService.registerUser(userData2),
      ]);

      // Assert - Verify proper handling of concurrent operations
      expect(result1.status).toBe('fulfilled');
      expect(result2.status).toBe('rejected');

      // Verify both attempts were logged appropriately
      expect(mocks.mockLogger.info).toHaveBeenCalledWith(
        'User registered successfully',
        expect.objectContaining({ email: userData1.email })
      );
      expect(mocks.mockLogger.error).toHaveBeenCalledWith(
        'User registration failed',
        expect.any(Error)
      );
    });

    it('should maintain audit trail through all operations', async () => {
      // London School excels at testing cross-cutting concerns like auditing
      // Arrange
      mocks.mockUserRepository.findByEmail.mockResolvedValue(null);

      // Act
      await authService.registerUser(validUserData);

      // Assert - Verify comprehensive audit logging
      const allLogCalls = mocks.mockLogger.info.mock.calls;
      const auditMessages = allLogCalls.map(call => call[0]);

      expect(auditMessages).toContain('Registration attempt started');
      expect(auditMessages).toContain('Password hashed successfully');
      expect(auditMessages).toContain('User saved to database');
      expect(auditMessages).toContain('Tokens generated');
      expect(auditMessages).toContain('Verification email sent');
      expect(auditMessages).toContain('User registered successfully');

      // Verify audit context includes necessary metadata
      allLogCalls.forEach(([message, context]) => {
        expect(context).toHaveProperty('timestamp');
        expect(context).toHaveProperty('correlationId');
        expect(context).toHaveProperty('operation', 'registerUser');
      });
    });
  });

  describe('performance and monitoring', () => {
    it('should collect comprehensive performance metrics', async () => {
      // Arrange
      mocks.mockUserRepository.findByEmail.mockResolvedValue(null);

      // Act
      await authService.registerUser(validUserData);

      // Assert - Verify performance monitoring
      expect(mocks.mockMetrics.timing).toHaveBeenCalledWith(
        'auth.registration.duration',
        expect.any(Number)
      );
      expect(mocks.mockMetrics.timing).toHaveBeenCalledWith(
        'auth.password_hash.duration',
        expect.any(Number)
      );
      expect(mocks.mockMetrics.timing).toHaveBeenCalledWith(
        'auth.database_save.duration',
        expect.any(Number)
      );

      // Verify counter metrics
      expect(mocks.mockMetrics.increment).toHaveBeenCalledWith('auth.registration.attempt');
      expect(mocks.mockMetrics.increment).toHaveBeenCalledWith('auth.registration.success');

      // Verify gauge metrics
      expect(mocks.mockMetrics.gauge).toHaveBeenCalledWith(
        'auth.active_registrations',
        expect.any(Number)
      );
    });
  });
});

/**
 * This example demonstrates London School TDD principles:
 * 
 * 1. **Extensive Mocking**: Every dependency is mocked, allowing us to test
 *    the AuthService in complete isolation
 * 
 * 2. **Behavior Verification**: Tests focus on HOW objects collaborate,
 *    not just what they return
 * 
 * 3. **Interaction Testing**: We verify method calls, parameters, and
 *    call order to ensure proper orchestration
 * 
 * 4. **Contract Definition**: Mocks define the contracts between objects,
 *    driving interface design
 * 
 * 5. **Error Scenario Testing**: Comprehensive testing of error handling
 *    through mock failures
 * 
 * 6. **Outside-In Development**: Tests start from the service boundary
 *    and work inward through collaborations
 * 
 * This approach results in:
 * - Fast test execution (no external dependencies)
 * - Clear object responsibilities
 * - Well-defined interfaces
 * - Comprehensive error handling
 * - Excellent test coverage
 * - Easy refactoring (tests break only when behavior changes)
 */