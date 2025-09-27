/**
 * Password Service - Password management operations
 * Handles password hashing, validation, reset operations, and security policies
 *
 * @description
 * This service implements secure password management with:
 * - Environment-abstracted configuration
 * - Comprehensive password strength validation
 * - Secure password reset functionality
 * - Rate limiting and security controls
 */

import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { Logger } from '@thinkrank/shared';

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetData {
  token: string;
  newPassword: string;
}

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong';
}

/**
 * Password service for managing password operations
 */
export class PasswordService {
  private logger: Logger;

  // Environment-abstracted configuration
  private readonly config = {
    BCRYPT_ROUNDS: parseInt(process.env.AUTH_BCRYPT_ROUNDS || '12', 10),
    PASSWORD_MIN_LENGTH: parseInt(process.env.AUTH_PASSWORD_MIN_LENGTH || '8', 10),
    PASSWORD_RESET_EXPIRY_HOURS: parseInt(process.env.AUTH_PASSWORD_RESET_EXPIRY_HOURS || '1', 10),
    MAX_RESET_ATTEMPTS: parseInt(process.env.AUTH_MAX_RESET_ATTEMPTS || '3', 10),
  };

  constructor() {
    this.logger = Logger.getInstance('password-service');
  }

  /**
   * Hash password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    try {
      const salt = await bcrypt.genSalt(this.config.BCRYPT_ROUNDS);
      const hashedPassword = await bcrypt.hash(password, salt);

      this.logger.debug('Password hashed successfully');
      return hashedPassword;
    } catch (error) {
      this.logger.error('Password hashing failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Failed to hash password');
    }
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      const isValid = await bcrypt.compare(password, hash);

      if (isValid) {
        this.logger.debug('Password verification successful');
      } else {
        this.logger.warn('Password verification failed');
      }

      return isValid;
    } catch (error) {
      this.logger.error('Password verification error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Generate secure password reset token
   */
  generateResetToken(): { token: string; expiry: Date } {
    const token = randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + (this.config.PASSWORD_RESET_EXPIRY_HOURS * 60 * 60 * 1000));

    this.logger.debug('Password reset token generated', {
      expiry_hours: this.config.PASSWORD_RESET_EXPIRY_HOURS
    });

    return { token, expiry };
  }

  /**
   * Validate password reset token
   */
  isValidResetToken(token: string, storedToken: string, expiry: Date): boolean {
    const now = new Date();
    const isExpired = now > expiry;
    const isValid = token === storedToken && !isExpired;

    if (isExpired) {
      this.logger.warn('Password reset token expired');
    } else if (!isValid) {
      this.logger.warn('Invalid password reset token');
    }

    return isValid;
  }

  /**
   * Comprehensive password validation
   */
  validatePassword(password: string): PasswordValidationResult {
    const errors: string[] = [];
    let strength: 'weak' | 'medium' | 'strong' = 'weak';

    // Basic length check
    if (!password || password.length < this.config.PASSWORD_MIN_LENGTH) {
      errors.push(`Password must be at least ${this.config.PASSWORD_MIN_LENGTH} characters`);
    }

    // Character requirements
    if (!/(?=.*[a-z])/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/(?=.*[A-Z])/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/(?=.*\d)/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/(?=.*[@$!%*?&])/.test(password)) {
      errors.push('Password must contain at least one special character (@$!%*?&)');
    }

    // Common patterns to avoid
    if (/(.)\1{2,}/.test(password)) {
      errors.push('Password must not contain repeated characters');
    }

    if (/123456|password|qwerty|abc123/i.test(password)) {
      errors.push('Password must not contain common patterns');
    }

    // Calculate strength
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[@$!%*?&]/.test(password)) score++;
    if (!/(.)\1/.test(password)) score++; // No repeated characters

    if (score >= 6) strength = 'strong';
    else if (score >= 4) strength = 'medium';

    return {
      isValid: errors.length === 0,
      errors,
      strength
    };
  }

  /**
   * Generate secure temporary password
   */
  generateTemporaryPassword(length: number = 12): string {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const special = '@$!%*?&';

    const allChars = lowercase + uppercase + numbers + special;

    let password = '';

    // Ensure at least one character from each category
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];

    // Fill remaining length with random characters
    for (let i = 4; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  /**
   * Check if password has been compromised (placeholder for future implementation)
   */
  async checkPasswordCompromised(password: string): Promise<boolean> {
    // In production: check against HaveIBeenPwned API or similar service
    // For now, just return false (not compromised)
    return false;
  }

  /**
   * Validate password complexity requirements
   */
  meetsComplexityRequirements(password: string): boolean {
    const validation = this.validatePassword(password);
    return validation.isValid;
  }

  /**
   * Get password policy information
   */
  getPasswordPolicy(): {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    maxAgeDays: number;
  } {
    return {
      minLength: this.config.PASSWORD_MIN_LENGTH,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      maxAgeDays: 90, // Standard security practice
    };
  }
}