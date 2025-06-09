export interface RegisterUserDto {
  email: string;
  password: string;
  username: string;
}

export interface LoginUserDto {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: UserDto;
  accessToken: string;
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

export interface UserDto {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  xp: number;
  level: number;
}

export interface User {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  xp: number;
  level: number;
  createdAt: Date;
  updatedAt: Date;
  emailVerified: boolean;
  isActive: boolean;
}

export type UserRole = 'player' | 'researcher' | 'admin';

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export interface RefreshTokenPayload {
  userId: string;
}