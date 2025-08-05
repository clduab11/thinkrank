// JWT token types for ThinkRank authentication
export interface JwtTokenPayload {
  userId: string;
  email: string;
  username: string;
  subscription_tier: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

export interface AccessTokenPayload extends JwtTokenPayload {
  type: 'access';
}

export interface RefreshTokenPayload extends JwtTokenPayload {
  type: 'refresh';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// Type guard for JWT payload validation
export function isValidJwtPayload(payload: unknown): payload is JwtTokenPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'userId' in payload &&
    'email' in payload &&
    'username' in payload &&
    'subscription_tier' in payload &&
    'type' in payload &&
    ((payload as any).type === 'access' || (payload as any).type === 'refresh')
  );
}

// Type guard for refresh token payload
export function isRefreshTokenPayload(payload: unknown): payload is RefreshTokenPayload {
  return isValidJwtPayload(payload) && payload.type === 'refresh';
}

// Type guard for access token payload
export function isAccessTokenPayload(payload: unknown): payload is AccessTokenPayload {
  return isValidJwtPayload(payload) && payload.type === 'access';
}