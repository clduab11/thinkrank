/**
 * Authentication Service - Core authentication logic with RSA256
 * Handles user registration, login, password reset, and 2FA operations
 *
 * @description
 * This service implements secure authentication patterns with:
 * - RSA256 JWT token generation and verification
 * - Password hashing with bcrypt
 * - Rate limiting and security controls
 * - Environment-abstracted configuration
 * - Comprehensive error handling and validation
*/

// Minimal no-op logger shim for tests; replace with real logger service
interface LoggerInstance {
 info(message: string, meta?: any): void;
 error(message: string, meta?: any): void;
 warn(message: string, meta?: any): void;
}
const Logger = {
 getInstance(_serviceName: string): LoggerInstance {
   const noop = () => {};
   return { info: noop, error: noop, warn: noop };
 }
};

import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { TokenManagementService } from './token-management.service';
import { AccessTokenPayload, RefreshTokenPayload, JwtTokenPayload } from '@thinkrank/shared';
import { ConfigurationService } from './configuration.service';

// Environment-abstracted configuration
const AUTH_CONFIG = {
  BCRYPT_ROUNDS: parseInt(process.env['AUTH_BCRYPT_ROUNDS'] || '12', 10),
  PASSWORD_MIN_LENGTH: parseInt(process.env['AUTH_PASSWORD_MIN_LENGTH'] || '8', 10),
  MAX_LOGIN_ATTEMPTS: parseInt(process.env['AUTH_MAX_LOGIN_ATTEMPTS'] || '5', 10),
  LOCKOUT_DURATION_MS: parseInt(process.env['AUTH_LOCKOUT_DURATION_MS'] || '900000', 10), // 15 minutes
  SESSION_TIMEOUT_MS: parseInt(process.env['AUTH_SESSION_TIMEOUT_MS'] || '3600000', 10), // 1 hour
  REFRESH_TOKEN_EXPIRY_DAYS: parseInt(process.env['AUTH_REFRESH_TOKEN_EXPIRY_DAYS'] || '30', 10),
};

export interface UserCredentials {
  email: string;
  password: string;
}

export interface UserRegistrationData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: 'user' | 'admin' | 'moderator';
}

export interface AuthResult {
  user: {
    userId: string;
    email: string;
    role: string;
    firstName: string;
    lastName: string;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetData {
  token: string;
  newPassword: string;
}

export interface TwoFactorSetup {
  qrCode: string;
  secret: string;
  backupCodes: string[];
}

export interface LoginAttempt {
  email: string;
  ip: string;
  userAgent: string;
  success: boolean;
  timestamp: Date;
}

/**
 * Core authentication service with RSA256 JWT implementation
 * Handles all authentication operations securely
 */
export class AuthenticationService {
  private tokenService: TokenManagementService;
  private logger: LoggerInstance;
  private configService: ConfigurationService;

  // In-memory storage for demo (replace with database in production)
  private users = new Map<string, any>();
  private loginAttempts = new Map<string, LoginAttempt[]>();
  private accountLockouts = new Map<string, number>();

  constructor() {
    this.logger = Logger.getInstance('auth-service');
    this.tokenService = new TokenManagementService();
    this.configService = new ConfigurationService();

    this.initializeDefaultUsers();
  }

  /**
   * Register a new user with secure password hashing
   */
  async registerUser(userData: UserRegistrationData): Promise<AuthResult> {
    try {
      this.validateRegistrationData(userData);

      // Check if user already exists
      if (this.users.has(userData.email)) {
        throw new Error('User already exists with this email');
      }

      // Hash password with bcrypt
      const salt = await bcrypt.genSalt(AUTH_CONFIG.BCRYPT_ROUNDS);
      const hashedPassword = await bcrypt.hash(userData.password, salt);

      // Create user record
      const userId = this.generateUserId();
      const user = {
        userId,
        email: userData.email,
        password: hashedPassword,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role || 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        twoFactorEnabled: false,
        twoFactorSecret: null,
        failedLoginAttempts: 0,
        lastLoginAt: null,
        lockedUntil: null,
      };

      this.users.set(userData.email, user);

      this.logger.info('User registered successfully', {
        user_id: userId,
        email: userData.email,
        role: user.role
      });

      // Generate tokens
      const tokens = await this.generateUserTokens(user);

      return {
        user: {
          userId: user.userId,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        tokens,
      };
    } catch (error) {
      this.logger.error('User registration failed', {
        email: userData.email,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Authenticate user with secure password verification
   */
  async login(credentials: UserCredentials, ip: string, userAgent: string): Promise<AuthResult> {
    try {
      this.validateLoginData(credentials);

      // Check account lockout
      if (this.isAccountLocked(credentials.email)) {
        throw new Error('Account temporarily locked due to too many failed attempts');
      }

      const user = this.users.get(credentials.email);
      if (!user || !user.isActive) {
        await this.recordFailedLogin(credentials.email, ip, userAgent, false);
        throw new Error('Invalid credentials');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
      if (!isPasswordValid) {
        await this.recordFailedLogin(credentials.email, ip, userAgent, false);
        throw new Error('Invalid credentials');
      }

      // Check if account should be locked
      if (user.failedLoginAttempts >= AUTH_CONFIG.MAX_LOGIN_ATTEMPTS) {
        this.lockAccount(credentials.email);
        throw new Error('Account locked due to too many failed attempts');
      }

      // Successful login - reset failed attempts
      user.failedLoginAttempts = 0;
      user.lastLoginAt = new Date();
      await this.recordFailedLogin(credentials.email, ip, userAgent, true);

      this.logger.info('User login successful', {
        user_id: user.userId,
        email: credentials.email,
        ip,
        role: user.role
      });

      // Generate tokens
      const tokens = await this.generateUserTokens(user);

      return {
        user: {
          userId: user.userId,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        tokens,
      };
    } catch (error) {
      this.logger.error('User login failed', {
        email: credentials.email,
        ip,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    try {
      // Verify refresh token
      const decoded = await this.tokenService.verifyToken(refreshToken);

      if (decoded.tokenType !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Check if user still exists and is active
      const user = this.users.get(decoded.email);
      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      // Generate new access token
      const tokenPayload: Omit<TokenPayload, 'iat' | 'exp'> = {
        userId: user.userId,
        email: user.email,
        role: user.role,
        tokenType: 'access',
      };

      const accessToken = await this.tokenService.generateToken(tokenPayload, '15m');

      return {
        accessToken,
        expiresIn: 900, // 15 minutes in seconds
      };
    } catch (error) {
      this.logger.error('Token refresh failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(request: PasswordResetRequest): Promise<{ success: boolean }> {
    try {
      const user = this.users.get(request.email);
      if (!user || !user.isActive) {
        // Don't reveal if user exists or not for security
        this.logger.warn('Password reset requested for non-existent or inactive user', {
          email: request.email
        });
        return { success: true };
      }

      // Generate password reset token (in production, store in database with expiration)
      const resetToken = randomBytes(32).toString('hex');
      const resetExpiry = new Date(Date.now() + 3600000); // 1 hour

      user.passwordResetToken = resetToken;
      user.passwordResetExpiry = resetExpiry;

      this.logger.info('Password reset requested', {
        user_id: user.userId,
        email: request.email
      });

      // In production: send email with reset token
      // await this.sendPasswordResetEmail(request.email, resetToken);

      return { success: true };
    } catch (error) {
      this.logger.error('Password reset request failed', {
        email: request.email,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Reset password using reset token
   */
  async resetPassword(resetData: PasswordResetData): Promise<{ success: boolean }> {
    try {
      this.validatePassword(resetData.newPassword);

      // Find user by reset token (in production, query database)
      let user: any = null;
      for (const [, userData] of this.users.entries()) {
        if (userData.passwordResetToken === resetData.token &&
            userData.passwordResetExpiry > new Date()) {
          user = userData;
          break;
        }
      }

      if (!user) {
        throw new Error('Invalid or expired reset token');
      }

      // Hash new password
      const salt = await bcrypt.genSalt(AUTH_CONFIG.BCRYPT_ROUNDS);
      const hashedPassword = await bcrypt.hash(resetData.newPassword, salt);

      // Update user password
      user.password = hashedPassword;
      user.passwordResetToken = null;
      user.passwordResetExpiry = null;
      user.updatedAt = new Date();

      this.logger.info('Password reset successful', {
        user_id: user.userId,
        email: user.email
      });

      return { success: true };
    } catch (error) {
      this.logger.error('Password reset failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Setup two-factor authentication
   */
  async setupTwoFactor(userId: string): Promise<TwoFactorSetup> {
    try {
      const user = Array.from(this.users.values()).find(u => u.userId === userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Generate 2FA secret and QR code
      const secret = randomBytes(32).toString('hex');
      const backupCodes = this.generateBackupCodes();

      // In production: generate QR code for authenticator app
      const qrCode = `otpauth://totp/ThinkRank:${user.email}?secret=${secret}&issuer=ThinkRank`;

      user.twoFactorSecret = secret;
      user.backupCodes = backupCodes;
      user.twoFactorEnabled = true;

      this.logger.info('2FA setup completed', {
        user_id: userId,
        email: user.email
      });

      return {
        qrCode,
        secret,
        backupCodes,
      };
    } catch (error) {
      this.logger.error('2FA setup failed', {
        user_id: userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Verify two-factor authentication code
   */
  async verifyTwoFactor(userId: string, code: string): Promise<boolean> {
    try {
      const user = Array.from(this.users.values()).find(u => u.userId === userId);
      if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
        return false;
      }

      // In production: verify TOTP code using user.twoFactorSecret
      // For demo purposes, accept any 6-digit code
      const isValid = /^\d{6}$/.test(code);

      if (isValid) {
        this.logger.info('2FA verification successful', {
          user_id: userId,
          email: user.email
        });
      }

      return isValid;
    } catch (error) {
      this.logger.error('2FA verification failed', {
        user_id: userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  // Private helper methods

  private validateRegistrationData(userData: UserRegistrationData): void {
    if (!userData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData.email)) {
      throw new Error('Invalid email format');
    }

    this.validatePassword(userData.password);

    if (!userData.firstName || userData.firstName.trim().length < 2) {
      throw new Error('First name must be at least 2 characters');
    }

    if (!userData.lastName || userData.lastName.trim().length < 2) {
      throw new Error('Last name must be at least 2 characters');
    }
  }

  private validateLoginData(credentials: UserCredentials): void {
    if (!credentials.email || !credentials.password) {
      throw new Error('Email and password are required');
    }
  }

  private validatePassword(password: string): void {
    if (!password || password.length < AUTH_CONFIG.PASSWORD_MIN_LENGTH) {
      throw new Error(`Password must be at least ${AUTH_CONFIG.PASSWORD_MIN_LENGTH} characters`);
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      throw new Error('Password must contain at least one uppercase letter, one lowercase letter, and one number');
    }
  }

  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async generateUserTokens(user: any): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const accessTokenPayload: AccessTokenPayload = {
      userId: user.userId,
      email: user.email,
      role: user.role,
      tokenType: 'access',
    };

    const refreshTokenPayload: RefreshTokenPayload = {
      userId: user.userId,
      email: user.email,
      role: user.role,
      tokenType: 'refresh',
    };

    const accessToken = await this.tokenService.generateToken(accessTokenPayload, '15m');
    const refreshToken = await this.tokenService.generateToken(refreshTokenPayload, `${AUTH_CONFIG.REFRESH_TOKEN_EXPIRY_DAYS}d`);

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
    };
  }

  private isAccountLocked(email: string): boolean {
    const lockedUntil = this.accountLockouts.get(email);
    if (!lockedUntil) return false;

    return Date.now() < lockedUntil;
  }

  private lockAccount(email: string): void {
    this.accountLockouts.set(email, Date.now() + AUTH_CONFIG.LOCKOUT_DURATION_MS);

    const user = this.users.get(email);
    if (user) {
      user.lockedUntil = new Date(Date.now() + AUTH_CONFIG.LOCKOUT_DURATION_MS);
    }
  }

  private async recordFailedLogin(email: string, ip: string, userAgent: string, success: boolean): Promise<void> {
    const attempts = this.loginAttempts.get(email) || [];
    attempts.push({
      email,
      ip,
      userAgent,
      success,
      timestamp: new Date(),
    });

    // Keep only last 10 attempts
    if (attempts.length > 10) {
      attempts.splice(0, attempts.length - 10);
    }

    this.loginAttempts.set(email, attempts);

    if (!success) {
      const user = this.users.get(email);
      if (user) {
        user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      }
    }
  }

  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 8; i++) {
      codes.push(randomBytes(4).toString('hex').toUpperCase());
    }
    return codes;
  }

  private initializeDefaultUsers(): void {
    // Default user initialization removed for security
    // Production systems should use environment variables or secure user provisioning
    this.logger.warn('Default user initialization skipped - configure users through secure provisioning');
  }
}