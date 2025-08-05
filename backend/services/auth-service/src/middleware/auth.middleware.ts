import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { logger } from '@thinkrank/shared';

interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
  jti: string;
}

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

/**
 * Secure JWT authentication middleware with RSA256 signing
 * - Uses RS256 algorithm with public/private key pairs
 * - Implements key rotation support
 * - Comprehensive token validation
 * - Anti-tampering protection
 */
export class SecureAuthMiddleware {
  private static publicKeys: Map<string, string> = new Map();
  private static privateKey: string;
  
  /**
   * Initialize JWT keys with proper RSA256 configuration
   */
  public static async initialize(): Promise<void> {
    try {
      // Generate RSA key pair if not provided via secrets
      if (!process.env.JWT_PRIVATE_KEY || !process.env.JWT_PUBLIC_KEY) {
        const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
          modulusLength: 2048,
          publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
          },
          privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
          }
        });
        
        this.privateKey = privateKey;
        this.publicKeys.set('default', publicKey);
        
        logger.warn('Generated RSA keys at runtime - ensure proper key management in production');
      } else {
        this.privateKey = process.env.JWT_PRIVATE_KEY;
        this.publicKeys.set('default', process.env.JWT_PUBLIC_KEY);
      }
      
      // Load additional public keys for key rotation
      if (process.env.JWT_PUBLIC_KEYS) {
        const additionalKeys = JSON.parse(process.env.JWT_PUBLIC_KEYS);
        for (const [keyId, publicKey] of Object.entries(additionalKeys)) {
          this.publicKeys.set(keyId, publicKey as string);
        }
      }
      
      logger.info('JWT authentication initialized with RSA256');
    } catch (error) {
      logger.error('Failed to initialize JWT authentication', { error });
      throw new Error('Authentication initialization failed');
    }
  }
  
  /**
   * Generate secure JWT token with RSA256 signing
   */
  public static generateToken(payload: { userId: string; email: string; role: string }): string {
    const jti = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    
    const tokenPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
      ...payload,
      jti
    };
    
    return jwt.sign(tokenPayload, this.privateKey, {
      algorithm: 'RS256',
      expiresIn: '15m', // Short-lived access tokens
      issuer: 'thinkrank-auth',
      audience: 'thinkrank-api',
      keyid: 'default'
    });
  }
  
  /**
   * Generate refresh token with longer expiration
   */
  public static generateRefreshToken(payload: { userId: string }): string {
    const jti = crypto.randomUUID();
    
    return jwt.sign(
      { ...payload, jti, type: 'refresh' },
      this.privateKey,
      {
        algorithm: 'RS256',
        expiresIn: '7d',
        issuer: 'thinkrank-auth',
        audience: 'thinkrank-refresh',
        keyid: 'default'
      }
    );
  }
  
  /**
   * Middleware for JWT authentication with comprehensive validation
   */
  public static middleware = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Skip auth for health checks and public endpoints
      if (req.path.startsWith('/health') || req.path.startsWith('/public')) {
        return next();
      }
      
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_REQUIRED',
            message: 'Bearer token required',
            details: 'Authorization header must contain a valid Bearer token'
          },
          meta: {
            timestamp: new Date().toISOString(),
            request_id: req.headers['x-request-id'] || crypto.randomUUID()
          }
        });
      }
      
      const token = authHeader.split(' ')[1];
      
      // Validate token format
      if (!token || token.split('.').length !== 3) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN_FORMAT',
            message: 'Invalid JWT token format'
          }
        });
      }
      
      // Decode header to get key ID
      const header = JSON.parse(Buffer.from(token.split('.')[0], 'base64').toString());
      const keyId = header.kid || 'default';
      
      const publicKey = this.publicKeys.get(keyId);
      if (!publicKey) {
        logger.warn('Unknown key ID in token', { keyId });
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNKNOWN_KEY',
            message: 'Token signed with unknown key'
          }
        });
      }
      
      // Verify token with comprehensive options
      const decoded = jwt.verify(token, publicKey, {
        algorithms: ['RS256'],
        issuer: 'thinkrank-auth',
        audience: 'thinkrank-api',
        clockTolerance: 30 // 30 second clock skew tolerance
      }) as JWTPayload;
      
      // Additional security validations
      if (!decoded.userId || !decoded.email || !decoded.jti) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN_CLAIMS',
            message: 'Token missing required claims'
          }
        });
      }
      
      // Check token blacklist (in production, check against Redis/database)
      if (await this.isTokenBlacklisted(decoded.jti)) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'TOKEN_REVOKED',
            message: 'Token has been revoked'
          }
        });
      }
      
      // Attach user to request
      req.user = {
        id: decoded.userId,
        email: decoded.email,
        role: decoded.role || 'user'
      };
      
      // Set security headers
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      
      logger.debug('User authenticated successfully', {
        userId: decoded.userId,
        role: decoded.role,
        jti: decoded.jti
      });
      
      next();
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        logger.warn('JWT validation failed', {
          error: error.message,
          name: error.name
        });
        
        return res.status(401).json({
          success: false,
          error: {
            code: 'TOKEN_INVALID',
            message: 'Invalid or expired token',
            details: error.message
          }
        });
      }
      
      logger.error('Authentication middleware error', { error });
      return res.status(500).json({
        success: false,
        error: {
          code: 'AUTH_SERVICE_ERROR',
          message: 'Authentication service unavailable'
        }
      });
    }
  };
  
  /**
   * Check if token is blacklisted (implement with Redis in production)
   */
  private static async isTokenBlacklisted(jti: string): Promise<boolean> {
    // TODO: Implement Redis-based token blacklist check
    // const isBlacklisted = await redisClient.exists(`blacklist:${jti}`);
    // return isBlacklisted === 1;
    return false;
  }
  
  /**
   * Revoke token by adding to blacklist
   */
  public static async revokeToken(jti: string, expiresAt: Date): Promise<void> {
    // TODO: Implement Redis-based token blacklist
    // const ttl = Math.ceil((expiresAt.getTime() - Date.now()) / 1000);
    // await redisClient.setex(`blacklist:${jti}`, ttl, '1');
    logger.info('Token revoked', { jti });
  }
  
  /**
   * Rotate JWT signing keys
   */
  public static async rotateKeys(): Promise<void> {
    try {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      });
      
      // Keep old keys for validation during rotation period
      const newKeyId = `key-${Date.now()}`;
      this.publicKeys.set(newKeyId, publicKey);
      
      // Update private key for new token generation
      this.privateKey = privateKey;
      
      logger.info('JWT keys rotated successfully', { newKeyId });
      
      // Schedule cleanup of old keys after rotation period
      setTimeout(() => {
        this.cleanupOldKeys(newKeyId);
      }, 24 * 60 * 60 * 1000); // 24 hours
      
    } catch (error) {
      logger.error('Key rotation failed', { error });
      throw error;
    }
  }
  
  /**
   * Cleanup old keys after rotation period
   */
  private static cleanupOldKeys(currentKeyId: string): void {
    for (const [keyId] of this.publicKeys.entries()) {
      if (keyId !== currentKeyId && keyId !== 'default') {
        this.publicKeys.delete(keyId);
        logger.info('Cleaned up old JWT key', { keyId });
      }
    }
  }
}

// Export the middleware function for Express
export const authMiddleware = SecureAuthMiddleware.middleware;

// Export for initialization
export { SecureAuthMiddleware };