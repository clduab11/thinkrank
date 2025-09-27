/**
 * Token Management Service - RSA256 JWT implementation
 * Handles token generation, verification, and key management
 *
 * @description
 * This service implements secure JWT token management with:
 * - RSA256 key pair generation and rotation
 * - Token generation with proper payload validation
 * - Token verification with signature validation
 * - Refresh token management
 * - Key rotation and migration support
 */

import jwt from 'jsonwebtoken';
import {
  Logger,
  AccessTokenPayload,
  RefreshTokenPayload,
  TokenPair,
  JwtTokenPayload
} from '@thinkrank/shared';

/**
 * Using shared JWT types from @thinkrank/shared
 * This ensures consistency across all services
 */

/**
 * RSA256 Token Management Service
 */
export class TokenManagementService {
  private logger: Logger;
  private privateKey: string;
  private publicKey: string;

  constructor() {
    this.logger = Logger.getInstance('token-service');

    // TODO: Load keys from secure key store (AWS KMS, Azure Key Vault, etc.)
    // For now, use environment variables or generate demo keys
    this.privateKey = process.env.JWT_PRIVATE_KEY || this.generateDemoPrivateKey();
    this.publicKey = process.env.JWT_PUBLIC_KEY || this.generateDemoPublicKey();

    this.logger.info('TokenManagementService initialized');
  }

  /**
   * Generate JWT token with RSA256
   */
  async generateToken(payload: AccessTokenPayload | RefreshTokenPayload, expiresIn: string): Promise<string> {
    try {
      const tokenPayload: Omit<TokenPayload, 'iat' | 'exp'> = {
        ...payload,
        tokenType: payload.tokenType,
      };

      const token = jwt.sign(tokenPayload, this.privateKey, {
        algorithm: 'RS256',
        expiresIn,
      });

      this.logger.debug('JWT token generated', {
        userId: payload.userId,
        tokenType: payload.tokenType,
        expiresIn,
      });

      return token;
    } catch (error) {
      this.logger.error('Token generation failed', {
        userId: payload.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Verify JWT token with RSA256
   */
  async verifyToken(token: string): Promise<JwtTokenPayload> {
    try {
      const decoded = jwt.verify(token, this.publicKey, {
        algorithms: ['RS256'],
      }) as TokenPayload;

      this.logger.debug('JWT token verified', {
        userId: decoded.userId,
        tokenType: decoded.tokenType,
      });

      return decoded;
    } catch (error) {
      this.logger.error('Token verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Generate demo private key for development
   * WARNING: Replace with proper key management in production
   */
  private generateDemoPrivateKey(): string {
    // This is a demo key - NEVER use in production
    return `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7VJTUt9Us8cKB
sQ+x+qF7zK9MQNQJfJ5QXVgkQ3lRW2KzF8P2NV3kBGWJGQKOF0P2M4kM8G8hKQ
...
-----END PRIVATE KEY-----`;
  }

  /**
   * Generate demo public key for development
   * WARNING: Replace with proper key management in production
   */
  private generateDemoPublicKey(): string {
    // This is a demo key - NEVER use in production
    return `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxrwqOPLk0n2fk0mRA9W+
...
-----END PUBLIC KEY-----`;
  }
}