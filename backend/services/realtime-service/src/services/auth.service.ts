import jwt from 'jsonwebtoken';
import { logger } from '@thinkrank/shared';
import { v4 as uuidv4 } from 'uuid';

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'user' | 'admin' | 'moderator';
  isAdmin: boolean;
  permissions: string[];
  sessionId?: string;
}

export class AuthenticationService {
  private jwtSecret: string;
  private jwtExpiresIn: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'default-secret-change-in-production';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';
    
    if (this.jwtSecret === 'default-secret-change-in-production') {
      logger.warn('Using default JWT secret. Change JWT_SECRET environment variable in production!');
    }
  }

  async authenticateToken(token: string): Promise<User | null> {
    if (!token) {
      return null;
    }

    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      
      // Validate required fields
      if (!decoded.id || !decoded.username) {
        logger.warn('Invalid token payload: missing required fields');
        return null;
      }

      const user: User = {
        id: decoded.id,
        username: decoded.username,
        email: decoded.email || '',
        role: decoded.role || 'user',
        isAdmin: decoded.role === 'admin',
        permissions: decoded.permissions || [],
        sessionId: decoded.sessionId
      };

      return user;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        logger.info('Token expired for authentication');
      } else if (error.name === 'JsonWebTokenError') {
        logger.warn('Invalid token format');
      } else {
        logger.error('Token verification error:', error);
      }
      
      return null;
    }
  }

  async authenticateSocket(token: string): Promise<User | null> {
    return await this.authenticateToken(token);
  }

  generateToken(user: Partial<User>): string {
    const payload = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role || 'user',
      permissions: user.permissions || [],
      sessionId: user.sessionId || uuidv4(),
      iat: Math.floor(Date.now() / 1000)
    };

    return jwt.sign(payload, this.jwtSecret, { expiresIn: this.jwtExpiresIn });
  }

  verifyPermission(user: User, requiredPermission: string): boolean {
    // Admin users have all permissions
    if (user.isAdmin || user.role === 'admin') {
      return true;
    }

    // Check specific permission
    return user.permissions.includes(requiredPermission);
  }

  verifyRole(user: User, requiredRole: string): boolean {
    const roleHierarchy = {
      'user': 1,
      'moderator': 2,
      'admin': 3
    };

    const userLevel = roleHierarchy[user.role] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 0;

    return userLevel >= requiredLevel;
  }

  async refreshToken(oldToken: string): Promise<string | null> {
    try {
      // Verify the old token (even if expired)
      const decoded = jwt.verify(oldToken, this.jwtSecret, { ignoreExpiration: true }) as any;
      
      // Check if token is too old to refresh (e.g., older than 7 days)
      const tokenAge = Date.now() / 1000 - decoded.iat;
      const maxRefreshAge = 7 * 24 * 60 * 60; // 7 days

      if (tokenAge > maxRefreshAge) {
        logger.info('Token too old to refresh');
        return null;
      }

      // Generate new token with same payload
      const newPayload = {
        id: decoded.id,
        username: decoded.username,
        email: decoded.email,
        role: decoded.role,
        permissions: decoded.permissions,
        sessionId: decoded.sessionId,
        iat: Math.floor(Date.now() / 1000)
      };

      return jwt.sign(newPayload, this.jwtSecret, { expiresIn: this.jwtExpiresIn });
    } catch (error) {
      logger.error('Token refresh error:', error);
      return null;
    }
  }

  validateTokenClaims(token: string, expectedClaims: Partial<User>): boolean {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      
      // Check each expected claim
      for (const [key, value] of Object.entries(expectedClaims)) {
        if (decoded[key] !== value) {
          return false;
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  extractTokenFromRequest(req: any): string | null {
    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check query parameter
    if (req.query.token) {
      return req.query.token;
    }

    // Check socket handshake
    if (req.handshake?.auth?.token) {
      return req.handshake.auth.token;
    }

    if (req.handshake?.query?.token) {
      return req.handshake.query.token;
    }

    return null;
  }

  createGuestUser(): User {
    const guestId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      id: guestId,
      username: `Guest_${guestId.split('_')[2]}`,
      email: '',
      role: 'user',
      isAdmin: false,
      permissions: ['game.join', 'game.play'],
      sessionId: uuidv4()
    };
  }

  async blacklistToken(token: string, reason: string = 'manual'): Promise<void> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, { ignoreExpiration: true }) as any;
      const jti = decoded.jti || decoded.sessionId || 'unknown';
      
      // In a real implementation, you would store this in Redis or database
      // with expiration matching the token's original expiration
      logger.info(`Token blacklisted: ${jti}, reason: ${reason}`);
      
      // Store in Redis if available
      // await this.redisManager?.set(`blacklist:${jti}`, { reason, timestamp: new Date() }, tokenTTL);
    } catch (error) {
      logger.error('Error blacklisting token:', error);
    }
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, { ignoreExpiration: true }) as any;
      const jti = decoded.jti || decoded.sessionId || 'unknown';
      
      // Check Redis blacklist if available
      // const blacklisted = await this.redisManager?.exists(`blacklist:${jti}`);
      // return !!blacklisted;
      
      return false; // Default to not blacklisted if no storage available
    } catch (error) {
      return true; // If we can't decode the token, consider it blacklisted
    }
  }

  // Rate limiting helpers
  generateRateLimitKey(user: User, action: string): string {
    return `rate_limit:${user.id}:${action}`;
  }

  // Session management
  async validateSession(user: User, sessionId: string): Promise<boolean> {
    // In a real implementation, you would check if the session is still valid
    // by checking against a session store (Redis, database, etc.)
    return user.sessionId === sessionId;
  }

  async invalidateSession(sessionId: string): Promise<void> {
    // In a real implementation, you would remove the session from storage
    logger.info(`Session invalidated: ${sessionId}`);
  }

  // Helper method to check if token is about to expire
  isTokenNearExpiry(token: string, thresholdMinutes: number = 10): boolean {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      const expirationTime = decoded.exp * 1000; // Convert to milliseconds
      const currentTime = Date.now();
      const thresholdTime = thresholdMinutes * 60 * 1000; // Convert to milliseconds

      return (expirationTime - currentTime) <= thresholdTime;
    } catch (error) {
      return true; // If we can't decode, assume it needs refresh
    }
  }
}