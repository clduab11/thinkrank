import type { User, JwtPayload, RefreshTokenPayload } from '../../types/auth.types';

export interface ITokenService {
  generateAccessToken(user: User): string;
  generateRefreshToken(user: User): string;
  verifyAccessToken(token: string): Promise<JwtPayload>;
  verifyRefreshToken(token: string): Promise<RefreshTokenPayload>;
  revokeToken(token: string): Promise<void>;
}