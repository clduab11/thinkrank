import jwt from 'jsonwebtoken';
import type Redis from 'ioredis';
import type { ITokenService } from './interfaces/token.service.interface';
import type { User, JwtPayload, RefreshTokenPayload } from '../types/auth.types';

export class TokenService implements ITokenService {
  constructor(
    private readonly redis: Redis,
    private readonly jwtSecret: string,
    private readonly jwtRefreshSecret: string,
    private readonly accessTokenExpiry: string,
    private readonly refreshTokenExpiry: string
  ) {}

  generateAccessToken(user: User): string {
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.accessTokenExpiry,
    } as jwt.SignOptions);
  }

  generateRefreshToken(user: User): string {
    const payload: RefreshTokenPayload = {
      userId: user.id,
    };

    return jwt.sign(payload, this.jwtRefreshSecret, {
      expiresIn: this.refreshTokenExpiry,
    } as jwt.SignOptions);
  }

  async verifyAccessToken(token: string): Promise<JwtPayload> {
    const isRevoked = await this.isTokenRevoked(token);
    if (isRevoked) {
      throw new Error('Token has been revoked');
    }

    try {
      const payload = jwt.verify(token, this.jwtSecret) as JwtPayload;
      return payload;
    } catch (error) {
      throw new Error('Invalid access token');
    }
  }

  async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    const isRevoked = await this.isTokenRevoked(token);
    if (isRevoked) {
      throw new Error('Token has been revoked');
    }

    try {
      const payload = jwt.verify(token, this.jwtRefreshSecret) as RefreshTokenPayload;
      return payload;
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  async revokeToken(token: string): Promise<void> {
    const key = `revoked:${this.hashToken(token)}`;
    let ttl = 86400; // Default 24 hours

    try {
      const decoded = jwt.decode(token) as any;
      if (decoded && decoded.exp) {
        const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
        if (expiresIn > 0) {
          ttl = expiresIn;
        }
      }
    } catch {
      // Use default TTL if token cannot be decoded
    }

    await this.redis.setex(key, ttl, 'revoked');
  }

  private async isTokenRevoked(token: string): Promise<boolean> {
    const key = `revoked:${this.hashToken(token)}`;
    const result = await this.redis.get(key);
    return result === 'revoked';
  }

  private hashToken(token: string): string {
    // Simple hash for token storage key
    return Buffer.from(token).toString('base64').slice(0, 32);
  }
}