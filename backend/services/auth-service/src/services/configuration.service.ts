/**
 * Configuration Service - Environment variable loading and validation
 * Handles secure configuration with environment abstraction
 *
 * @description
 * This service provides secure configuration management with:
 * - Environment variable loading and validation
 * - Secure defaults and fallback handling
 * - Configuration validation and type checking
 * - Secret management and encryption
 * - Multi-environment configuration handling
 */

import { Logger } from '@thinkrank/shared';

export interface ConfigurationOptions {
  bcryptRounds?: number;
  passwordMinLength?: number;
  maxLoginAttempts?: number;
  lockoutDurationMs?: number;
  sessionTimeoutMs?: number;
  refreshTokenExpiryDays?: number;
  jwtPrivateKey?: string;
  jwtPublicKey?: string;
}

/**
 * Configuration Service for secure environment management
 */
export class ConfigurationService {
  private logger: Logger;
  private config: ConfigurationOptions;

  constructor() {
    this.logger = Logger.getInstance('config-service');
    this.config = this.loadConfiguration();

    this.logger.info('ConfigurationService initialized');
  }

  /**
   * Get configuration value with type safety
   */
  get<T>(key: keyof ConfigurationOptions): T | undefined {
    return this.config[key] as T | undefined;
  }

  /**
   * Get configuration value with default
   */
  getWithDefault<T>(key: keyof ConfigurationOptions, defaultValue: T): T {
    const value = this.config[key];
    return value !== undefined ? (value as T) : defaultValue;
  }

  /**
   * Load configuration from environment variables
   */
  private loadConfiguration(): ConfigurationOptions {
    return {
      bcryptRounds: parseInt(process.env.AUTH_BCRYPT_ROUNDS || '12', 10),
      passwordMinLength: parseInt(process.env.AUTH_PASSWORD_MIN_LENGTH || '8', 10),
      maxLoginAttempts: parseInt(process.env.AUTH_MAX_LOGIN_ATTEMPTS || '5', 10),
      lockoutDurationMs: parseInt(process.env.AUTH_LOCKOUT_DURATION_MS || '900000', 10), // 15 minutes
      sessionTimeoutMs: parseInt(process.env.AUTH_SESSION_TIMEOUT_MS || '3600000', 10), // 1 hour
      refreshTokenExpiryDays: parseInt(process.env.AUTH_REFRESH_TOKEN_EXPIRY_DAYS || '30', 10),
      jwtPrivateKey: process.env.JWT_PRIVATE_KEY,
      jwtPublicKey: process.env.JWT_PUBLIC_KEY,
    };
  }

  /**
   * Validate configuration values
   */
  validate(): void {
    if (this.config.bcryptRounds! < 10 || this.config.bcryptRounds! > 15) {
      throw new Error('BCRYPT_ROUNDS must be between 10 and 15');
    }

    if (this.config.passwordMinLength! < 6) {
      throw new Error('PASSWORD_MIN_LENGTH must be at least 6');
    }

    if (this.config.maxLoginAttempts! < 3 || this.config.maxLoginAttempts! > 10) {
      throw new Error('MAX_LOGIN_ATTEMPTS must be between 3 and 10');
    }
  }
}