import { TokenService } from '../../services/token.service';
import type { User } from '../../types/auth.types';
import jwt from 'jsonwebtoken';
import Redis from 'ioredis';

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    setex: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
  }));
});

describe('TokenService', () => {
  let tokenService: TokenService;
  let mockRedis: jest.Mocked<Redis>;
  
  const jwtSecret = 'test-secret';
  const jwtRefreshSecret = 'test-refresh-secret';
  
  const testUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    username: 'testuser',
    passwordHash: 'hash',
    role: 'player',
    xp: 0,
    level: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    emailVerified: true,
    isActive: true,
  };

  beforeEach(() => {
    mockRedis = new Redis() as jest.Mocked<Redis>;
    tokenService = new TokenService(
      mockRedis,
      jwtSecret,
      jwtRefreshSecret,
      '15m',
      '7d'
    );
  });

  describe('generateAccessToken', () => {
    it('should generate a valid access token', () => {
      const token = tokenService.generateAccessToken(testUser);
      
      const decoded = jwt.verify(token, jwtSecret) as any;
      
      expect(decoded.userId).toBe(testUser.id);
      expect(decoded.email).toBe(testUser.email);
      expect(decoded.role).toBe(testUser.role);
      expect(decoded.exp).toBeDefined();
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token', () => {
      const token = tokenService.generateRefreshToken(testUser);
      
      const decoded = jwt.verify(token, jwtRefreshSecret) as any;
      
      expect(decoded.userId).toBe(testUser.id);
      expect(decoded.exp).toBeDefined();
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify a valid access token', async () => {
      const token = jwt.sign(
        {
          userId: testUser.id,
          email: testUser.email,
          role: testUser.role,
        },
        jwtSecret,
        { expiresIn: '15m' }
      );

      mockRedis.get.mockResolvedValue(null);

      const payload = await tokenService.verifyAccessToken(token);

      expect(payload.userId).toBe(testUser.id);
      expect(payload.email).toBe(testUser.email);
      expect(payload.role).toBe(testUser.role);
    });

    it('should throw error for revoked token', async () => {
      const token = jwt.sign(
        {
          userId: testUser.id,
          email: testUser.email,
          role: testUser.role,
        },
        jwtSecret,
        { expiresIn: '15m' }
      );

      mockRedis.get.mockResolvedValue('revoked');

      await expect(tokenService.verifyAccessToken(token)).rejects.toThrow(
        'Token has been revoked'
      );
    });

    it('should throw error for invalid token', async () => {
      const invalidToken = 'invalid-token';

      await expect(tokenService.verifyAccessToken(invalidToken)).rejects.toThrow();
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify a valid refresh token', async () => {
      const token = jwt.sign(
        { userId: testUser.id },
        jwtRefreshSecret,
        { expiresIn: '7d' }
      );

      mockRedis.get.mockResolvedValue(null);

      const payload = await tokenService.verifyRefreshToken(token);

      expect(payload.userId).toBe(testUser.id);
    });

    it('should throw error for revoked refresh token', async () => {
      const token = jwt.sign(
        { userId: testUser.id },
        jwtRefreshSecret,
        { expiresIn: '7d' }
      );

      mockRedis.get.mockResolvedValue('revoked');

      await expect(tokenService.verifyRefreshToken(token)).rejects.toThrow(
        'Token has been revoked'
      );
    });

    it('should throw error for invalid refresh token', async () => {
      const invalidToken = 'invalid-refresh-token';

      mockRedis.get.mockResolvedValue(null);

      await expect(tokenService.verifyRefreshToken(invalidToken)).rejects.toThrow(
        'Invalid refresh token'
      );
    });
  });

  describe('revokeToken', () => {
    it('should revoke a token by storing it in Redis', async () => {
      const token = jwt.sign(
        { userId: testUser.id },
        jwtSecret,
        { expiresIn: '15m' }
      );

      await tokenService.revokeToken(token);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('revoked:'),
        expect.any(Number),
        'revoked'
      );
    });

    it('should handle invalid tokens gracefully', async () => {
      const invalidToken = 'invalid-token';

      await tokenService.revokeToken(invalidToken);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('revoked:'),
        86400,
        'revoked'
      );
    });
  });
});