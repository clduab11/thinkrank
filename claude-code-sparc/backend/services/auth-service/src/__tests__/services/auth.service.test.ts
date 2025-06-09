import { AuthService } from '../../services/auth.service';
import type { IUserRepository } from '../../repositories/interfaces/user.repository.interface';
import type { ITokenService } from '../../services/interfaces/token.service.interface';
import type { IPasswordService } from '../../services/interfaces/password.service.interface';
import type { RegisterUserDto, LoginUserDto } from '../../types/auth.types';

describe('AuthService', () => {
  let authService: AuthService;
  let mockUserRepository: jest.Mocked<IUserRepository>;
  let mockTokenService: jest.Mocked<ITokenService>;
  let mockPasswordService: jest.Mocked<IPasswordService>;

  beforeEach(() => {
    mockUserRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    mockTokenService = {
      generateAccessToken: jest.fn(),
      generateRefreshToken: jest.fn(),
      verifyAccessToken: jest.fn(),
      verifyRefreshToken: jest.fn(),
      revokeToken: jest.fn(),
    };

    mockPasswordService = {
      hash: jest.fn(),
      verify: jest.fn(),
    };

    authService = new AuthService(
      mockUserRepository,
      mockTokenService,
      mockPasswordService
    );
  });

  describe('register', () => {
    it('should successfully register a new user', async () => {
      const registerDto: RegisterUserDto = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
        username: 'testuser',
      };

      const hashedPassword = 'hashed_password';
      const newUser = {
        id: 'user-123',
        email: registerDto.email,
        username: registerDto.username,
        passwordHash: hashedPassword,
        role: 'player' as const,
        xp: 0,
        level: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerified: false,
        isActive: true,
      };

      const accessToken = 'access_token';
      const refreshToken = 'refresh_token';

      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockPasswordService.hash.mockResolvedValue(hashedPassword);
      mockUserRepository.create.mockResolvedValue(newUser);
      mockTokenService.generateAccessToken.mockReturnValue(accessToken);
      mockTokenService.generateRefreshToken.mockReturnValue(refreshToken);

      const result = await authService.register(registerDto);

      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(registerDto.email);
      expect(mockPasswordService.hash).toHaveBeenCalledWith(registerDto.password);
      expect(mockUserRepository.create).toHaveBeenCalledWith({
        email: registerDto.email,
        username: registerDto.username,
        passwordHash: hashedPassword,
      });
      expect(mockTokenService.generateAccessToken).toHaveBeenCalledWith(newUser);
      expect(mockTokenService.generateRefreshToken).toHaveBeenCalledWith(newUser);
      
      expect(result).toEqual({
        user: {
          id: newUser.id,
          email: newUser.email,
          username: newUser.username,
          role: newUser.role,
          xp: newUser.xp,
          level: newUser.level,
        },
        accessToken,
        refreshToken,
      });
    });

    it('should throw error if email already exists', async () => {
      const registerDto: RegisterUserDto = {
        email: 'existing@example.com',
        password: 'Password123!',
        username: 'newuser',
      };

      mockUserRepository.findByEmail.mockResolvedValue({
        id: 'existing-user',
        email: registerDto.email,
        username: 'existinguser',
        passwordHash: 'hash',
        role: 'player',
        xp: 0,
        level: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerified: true,
        isActive: true,
      });

      await expect(authService.register(registerDto)).rejects.toThrow(
        'Email already registered'
      );
      expect(mockPasswordService.hash).not.toHaveBeenCalled();
      expect(mockUserRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should successfully login a user with valid credentials', async () => {
      const loginDto: LoginUserDto = {
        email: 'test@example.com',
        password: 'Password123!',
      };

      const user = {
        id: 'user-123',
        email: loginDto.email,
        username: 'testuser',
        passwordHash: 'hashed_password',
        role: 'player' as const,
        xp: 100,
        level: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerified: true,
        isActive: true,
      };

      const accessToken = 'access_token';
      const refreshToken = 'refresh_token';

      mockUserRepository.findByEmail.mockResolvedValue(user);
      mockPasswordService.verify.mockResolvedValue(true);
      mockTokenService.generateAccessToken.mockReturnValue(accessToken);
      mockTokenService.generateRefreshToken.mockReturnValue(refreshToken);

      const result = await authService.login(loginDto);

      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(loginDto.email);
      expect(mockPasswordService.verify).toHaveBeenCalledWith(
        loginDto.password,
        user.passwordHash
      );
      expect(result).toEqual({
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
          xp: user.xp,
          level: user.level,
        },
        accessToken,
        refreshToken,
      });
    });

    it('should throw error if user not found', async () => {
      const loginDto: LoginUserDto = {
        email: 'nonexistent@example.com',
        password: 'Password123!',
      };

      mockUserRepository.findByEmail.mockResolvedValue(null);

      await expect(authService.login(loginDto)).rejects.toThrow(
        'Invalid credentials'
      );
      expect(mockPasswordService.verify).not.toHaveBeenCalled();
    });

    it('should throw error if password is incorrect', async () => {
      const loginDto: LoginUserDto = {
        email: 'test@example.com',
        password: 'WrongPassword123!',
      };

      const user = {
        id: 'user-123',
        email: loginDto.email,
        username: 'testuser',
        passwordHash: 'hashed_password',
        role: 'player' as const,
        xp: 0,
        level: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerified: true,
        isActive: true,
      };

      mockUserRepository.findByEmail.mockResolvedValue(user);
      mockPasswordService.verify.mockResolvedValue(false);

      await expect(authService.login(loginDto)).rejects.toThrow(
        'Invalid credentials'
      );
    });

    it('should throw error if user account is not active', async () => {
      const loginDto: LoginUserDto = {
        email: 'test@example.com',
        password: 'Password123!',
      };

      const user = {
        id: 'user-123',
        email: loginDto.email,
        username: 'testuser',
        passwordHash: 'hashed_password',
        role: 'player' as const,
        xp: 0,
        level: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerified: true,
        isActive: false,
      };

      mockUserRepository.findByEmail.mockResolvedValue(user);
      mockPasswordService.verify.mockResolvedValue(true);

      await expect(authService.login(loginDto)).rejects.toThrow(
        'Account is deactivated'
      );
    });
  });

  describe('refreshToken', () => {
    it('should generate new tokens with valid refresh token', async () => {
      const refreshToken = 'valid_refresh_token';
      const userId = 'user-123';
      
      const user = {
        id: userId,
        email: 'test@example.com',
        username: 'testuser',
        passwordHash: 'hash',
        role: 'player' as const,
        xp: 0,
        level: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerified: true,
        isActive: true,
      };

      const newAccessToken = 'new_access_token';
      const newRefreshToken = 'new_refresh_token';

      mockTokenService.verifyRefreshToken.mockResolvedValue({ userId });
      mockUserRepository.findById.mockResolvedValue(user);
      mockTokenService.generateAccessToken.mockReturnValue(newAccessToken);
      mockTokenService.generateRefreshToken.mockReturnValue(newRefreshToken);

      const result = await authService.refreshToken(refreshToken);

      expect(mockTokenService.verifyRefreshToken).toHaveBeenCalledWith(refreshToken);
      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
      expect(mockTokenService.revokeToken).toHaveBeenCalledWith(refreshToken);
      expect(result).toEqual({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      });
    });

    it('should throw error if refresh token is invalid', async () => {
      const invalidToken = 'invalid_token';

      mockTokenService.verifyRefreshToken.mockRejectedValue(
        new Error('Invalid token')
      );

      await expect(authService.refreshToken(invalidToken)).rejects.toThrow(
        'Invalid refresh token'
      );
    });

    it('should throw error if user not found with refresh token', async () => {
      const refreshToken = 'valid_refresh_token';
      const userId = 'user-123';

      mockTokenService.verifyRefreshToken.mockResolvedValue({ userId });
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(authService.refreshToken(refreshToken)).rejects.toThrow(
        'Invalid refresh token'
      );
    });
  });

  describe('logout', () => {
    it('should successfully logout and revoke tokens', async () => {
      const accessToken = 'access_token';
      const refreshToken = 'refresh_token';

      await authService.logout(accessToken, refreshToken);

      expect(mockTokenService.revokeToken).toHaveBeenCalledWith(accessToken);
      expect(mockTokenService.revokeToken).toHaveBeenCalledWith(refreshToken);
    });
  });
});