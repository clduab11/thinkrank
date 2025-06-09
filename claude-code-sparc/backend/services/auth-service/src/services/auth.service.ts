import type { IUserRepository } from '../repositories/interfaces/user.repository.interface';
import type { ITokenService } from './interfaces/token.service.interface';
import type { IPasswordService } from './interfaces/password.service.interface';
import type {
  RegisterUserDto,
  LoginUserDto,
  AuthResponse,
  RefreshTokenResponse,
  UserDto,
} from '../types/auth.types';

export class AuthService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly tokenService: ITokenService,
    private readonly passwordService: IPasswordService
  ) {}

  async register(dto: RegisterUserDto): Promise<AuthResponse> {
    const existingUser = await this.userRepository.findByEmail(dto.email);
    if (existingUser) {
      throw new Error('Email already registered');
    }

    const passwordHash = await this.passwordService.hash(dto.password);

    const user = await this.userRepository.create({
      email: dto.email,
      username: dto.username,
      passwordHash,
    });

    const accessToken = this.tokenService.generateAccessToken(user);
    const refreshToken = this.tokenService.generateRefreshToken(user);

    return {
      user: this.mapToUserDto(user),
      accessToken,
      refreshToken,
    };
  }

  async login(dto: LoginUserDto): Promise<AuthResponse> {
    const user = await this.userRepository.findByEmail(dto.email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isPasswordValid = await this.passwordService.verify(
      dto.password,
      user.passwordHash
    );
    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }

    const accessToken = this.tokenService.generateAccessToken(user);
    const refreshToken = this.tokenService.generateRefreshToken(user);

    return {
      user: this.mapToUserDto(user),
      accessToken,
      refreshToken,
    };
  }

  async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    try {
      const payload = await this.tokenService.verifyRefreshToken(refreshToken);
      const user = await this.userRepository.findById(payload.userId);

      if (!user || !user.isActive) {
        throw new Error('Invalid refresh token');
      }

      await this.tokenService.revokeToken(refreshToken);

      const newAccessToken = this.tokenService.generateAccessToken(user);
      const newRefreshToken = this.tokenService.generateRefreshToken(user);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  async logout(accessToken: string, refreshToken: string): Promise<void> {
    await this.tokenService.revokeToken(accessToken);
    await this.tokenService.revokeToken(refreshToken);
  }

  private mapToUserDto(user: any): UserDto {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      xp: user.xp,
      level: user.level,
    };
  }
}