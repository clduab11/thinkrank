/**
 * User Service - User management operations
 * Handles user registration, data management, and user lifecycle
 *
 * @description
 * This service implements secure user management with:
 * - Environment-abstracted configuration
 * - Comprehensive input validation
 * - User lifecycle management
 * - Clean separation of concerns
 */

import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { Logger } from '@thinkrank/shared';

export interface UserData {
  userId: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'user' | 'admin' | 'moderator';
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  twoFactorEnabled: boolean;
  twoFactorSecret: string | null;
  failedLoginAttempts: number;
  lastLoginAt: Date | null;
  lockedUntil: Date | null;
}

export interface UserRegistrationData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: 'user' | 'admin' | 'moderator';
}

export interface UserProfile {
  userId: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
}

export interface IUserStorage {
  create(userData: UserData): Promise<void>;
  findByEmail(email: string): Promise<UserData | null>;
  findById(userId: string): Promise<UserData | null>;
  update(userId: string, updates: Partial<UserData>): Promise<void>;
  delete(userId: string): Promise<void>;
  exists(email: string): Promise<boolean>;
}

/**
 * In-memory user storage implementation
 * Replace with database adapter in production
 */
export class InMemoryUserStorage implements IUserStorage {
  private users = new Map<string, UserData>();

  async create(userData: UserData): Promise<void> {
    this.users.set(userData.email, { ...userData });
  }

  async findByEmail(email: string): Promise<UserData | null> {
    return this.users.get(email) || null;
  }

  async findById(userId: string): Promise<UserData | null> {
    for (const user of this.users.values()) {
      if (user.userId === userId) {
        return user;
      }
    }
    return null;
  }

  async update(userId: string, updates: Partial<UserData>): Promise<void> {
    for (const [email, user] of this.users.entries()) {
      if (user.userId === userId) {
        this.users.set(email, { ...user, ...updates, updatedAt: new Date() });
        break;
      }
    }
  }

  async delete(userId: string): Promise<void> {
    for (const [email, user] of this.users.entries()) {
      if (user.userId === userId) {
        this.users.delete(email);
        break;
      }
    }
  }

  async exists(email: string): Promise<boolean> {
    return this.users.has(email);
  }
}

/**
 * User service for managing user operations
 */
export class UserService {
  private logger: Logger;
  private userStorage: IUserStorage;

  // Environment-abstracted configuration
  private readonly config = {
    BCRYPT_ROUNDS: parseInt(process.env.AUTH_BCRYPT_ROUNDS || '12', 10),
    PASSWORD_MIN_LENGTH: parseInt(process.env.AUTH_PASSWORD_MIN_LENGTH || '8', 10),
  };

  constructor(userStorage?: IUserStorage) {
    this.logger = Logger.getInstance('user-service');
    this.userStorage = userStorage || new InMemoryUserStorage();
  }

  /**
   * Register a new user with secure password hashing
   */
  async registerUser(userData: UserRegistrationData): Promise<UserProfile> {
    try {
      this.validateRegistrationData(userData);

      // Check if user already exists
      if (await this.userStorage.exists(userData.email)) {
        throw new Error('User already exists with this email');
      }

      // Hash password with bcrypt
      const salt = await bcrypt.genSalt(this.config.BCRYPT_ROUNDS);
      const hashedPassword = await bcrypt.hash(userData.password, salt);

      // Create user record
      const userId = this.generateUserId();
      const user: UserData = {
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

      await this.userStorage.create(user);

      this.logger.info('User registered successfully', {
        user_id: userId,
        email: userData.email,
        role: user.role
      });

      return {
        userId: user.userId,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
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
   * Get user profile by email
   */
  async getUserByEmail(email: string): Promise<UserData | null> {
    return await this.userStorage.findByEmail(email);
  }

  /**
   * Get user profile by ID
   */
  async getUserById(userId: string): Promise<UserData | null> {
    return await this.userStorage.findById(userId);
  }

  /**
   * Update user data
   */
  async updateUser(userId: string, updates: Partial<UserData>): Promise<void> {
    await this.userStorage.update(userId, updates);
    this.logger.info('User updated successfully', { user_id: userId });
  }

  /**
   * Deactivate user account
   */
  async deactivateUser(userId: string): Promise<void> {
    await this.userStorage.update(userId, { isActive: false });
    this.logger.info('User deactivated', { user_id: userId });
  }

  /**
   * Validate registration data
   */
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

  /**
   * Validate password strength
   */
  private validatePassword(password: string): void {
    if (!password || password.length < this.config.PASSWORD_MIN_LENGTH) {
      throw new Error(`Password must be at least ${this.config.PASSWORD_MIN_LENGTH} characters`);
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      throw new Error('Password must contain at least one uppercase letter, one lowercase letter, and one number');
    }
  }

  /**
   * Generate unique user ID
   */
  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}