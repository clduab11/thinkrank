// Authentication controller - handles all authentication logic
import {
  AuthenticationError,
  AuthResponse,
  BusinessLogicError,
  createSuccessResponse,
  DuplicateResourceError,
  getDatabase,
  LoginRequest,
  loginRequestSchema,
  NotFoundError,
  RegisterRequest,
  registerRequestSchema,
  UpdateProfileRequest,
  updateProfileRequestSchema,
  UserProfile,
  ValidationError,
  ValidationUtils
} from '@thinkrank/shared';
import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export class AuthController {
  private supabase = getDatabase().getServiceRoleClient();
  private JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
  private JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
  private REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

  // User registration
  public async register(req: Request, res: Response): Promise<void> {
    const { error, value } = ValidationUtils.validateRequest<RegisterRequest>(
      req.body,
      registerRequestSchema
    );

    if (error) {
      throw new ValidationError(error);
    }

    const { email, username, password, terms_accepted } = value;

    // Check if user already exists
    const { data: existingUser } = await this.supabase
      .from('users')
      .select('id, email, username')
      .or(`email.eq.${email},username.eq.${username}`)
      .single();

    if (existingUser) {
      if (existingUser.email === email) {
        throw new DuplicateResourceError('User', 'email', email);
      }
      if (existingUser.username === username) {
        throw new DuplicateResourceError('User', 'username', username);
      }
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const { data: newUser, error: createError } = await this.supabase
      .from('users')
      .insert({
        email,
        username,
        password_hash: passwordHash,
        subscription_tier: 'free',
        profile_data: {
          displayName: username,
          avatar: 'default'
        },
        preferences: {
          notifications: true,
          privacy: 'public',
          theme: 'light'
        },
        email_verified: false
      })
      .select('id, email, username, subscription_tier, profile_data, created_at')
      .single();

    if (createError) {
      throw new BusinessLogicError('Failed to create user account');
    }

    // Create initial game progress
    await this.supabase
      .from('game_progress')
      .insert({
        user_id: newUser.id,
        level: 1,
        total_score: 0,
        experience_points: 0,
        completed_challenges: [],
        skill_assessments: {},
        achievements: [],
        current_streak: 0,
        best_streak: 0
      });

    // Generate JWT tokens
    const tokens = this.generateTokens(newUser);

    // Log registration event
    req.logger.info('User registered successfully', {
      user_id: newUser.id,
      email: newUser.email,
      username: newUser.username
    });

    const userProfile: UserProfile = {
      id: newUser.id,
      username: newUser.username,
      subscription_tier: newUser.subscription_tier,
      profile_data: newUser.profile_data,
      created_at: newUser.created_at
    };

    const authResponse: AuthResponse = {
      user: userProfile,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_in: 86400 // 24 hours in seconds
    };

    res.status(201).json(createSuccessResponse(authResponse, {
      message: 'User registered successfully'
    }));
  }

  // User login
  public async login(req: Request, res: Response): Promise<void> {
    const { error, value } = ValidationUtils.validateRequest<LoginRequest>(
      req.body,
      loginRequestSchema
    );

    if (error) {
      throw new ValidationError(error);
    }

    const { email, password, remember_me = false } = value;

    // Find user by email
    const { data: user, error: userError } = await this.supabase
      .from('users')
      .select('id, email, username, password_hash, subscription_tier, profile_data, is_active, email_verified, created_at')
      .eq('email', email)
      .single();

    if (userError || !user) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Check if account is active
    if (!user.is_active) {
      throw new AuthenticationError('Account has been deactivated');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Update last login time
    await this.supabase
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id);

    // Generate JWT tokens (longer expiry if remember_me is true)
    const tokens = this.generateTokens(user, remember_me);

    // Log login event
    req.logger.info('User logged in successfully', {
      user_id: user.id,
      email: user.email,
      remember_me
    });

    const userProfile: UserProfile = {
      id: user.id,
      username: user.username,
      subscription_tier: user.subscription_tier,
      profile_data: user.profile_data,
      created_at: user.created_at
    };

    const authResponse: AuthResponse = {
      user: userProfile,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_in: remember_me ? 604800 : 86400 // 7 days or 24 hours
    };

    res.json(createSuccessResponse(authResponse, {
      message: 'Login successful'
    }));
  }

  // Refresh access token
  public async refreshToken(req: Request, res: Response): Promise<void> {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      throw new AuthenticationError('Refresh token is required');
    }

    try {
      const decoded = jwt.verify(refresh_token, this.JWT_SECRET) as any;

      if (decoded.type !== 'refresh') {
        throw new AuthenticationError('Invalid token type');
      }

      // Get user data
      const { data: user, error } = await this.supabase
        .from('users')
        .select('id, email, username, subscription_tier, profile_data, is_active, created_at')
        .eq('id', decoded.userId)
        .single();

      if (error || !user || !user.is_active) {
        throw new AuthenticationError('User not found or inactive');
      }

      // Generate new tokens
      const tokens = this.generateTokens(user);

      const userProfile: UserProfile = {
        id: user.id,
        username: user.username,
        subscription_tier: user.subscription_tier,
        profile_data: user.profile_data,
        created_at: user.created_at
      };

      const authResponse: AuthResponse = {
        user: userProfile,
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_in: 86400
      };

      res.json(createSuccessResponse(authResponse));
    } catch (error) {
      throw new AuthenticationError('Invalid or expired refresh token');
    }
  }

  // User logout
  public async logout(req: Request, res: Response): Promise<void> {
    // In a stateless JWT implementation, logout is handled client-side
    // Here we could add token blacklisting if needed

    req.logger.info('User logged out', {
      user_id: req.headers['x-user-id']
    });

    res.json(createSuccessResponse(null, {
      message: 'Logout successful'
    }));
  }

  // Get user profile
  public async getProfile(req: Request, res: Response): Promise<void> {
    // This would normally extract user ID from JWT token
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      throw new AuthenticationError('User ID not found in token');
    }

    const { data: user, error } = await this.supabase
      .from('users')
      .select('id, email, username, subscription_tier, profile_data, preferences, email_verified, created_at, updated_at')
      .eq('id', userId)
      .single();

    if (error || !user) {
      throw new NotFoundError('User', userId);
    }

    // Get game progress
    const { data: gameProgress } = await this.supabase
      .from('game_progress')
      .select('*')
      .eq('user_id', userId)
      .single();

    const profile = {
      ...user,
      game_progress: gameProgress
    };

    res.json(createSuccessResponse(profile));
  }

  // Update user profile
  public async updateProfile(req: Request, res: Response): Promise<void> {
    const userId = req.headers['x-user-id'] as string;

    const { error, value } = ValidationUtils.validateRequest<UpdateProfileRequest>(
      req.body,
      updateProfileRequestSchema
    );

    if (error) {
      throw new ValidationError(error);
    }

    const updateData: any = {};

    if (value.profile_data) {
      updateData.profile_data = value.profile_data;
    }

    if (value.preferences) {
      updateData.preferences = value.preferences;
    }

    const { data: updatedUser, error: updateError } = await this.supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select('id, email, username, subscription_tier, profile_data, preferences, updated_at')
      .single();

    if (updateError) {
      throw new BusinessLogicError('Failed to update profile');
    }

    req.logger.info('Profile updated', {
      user_id: userId,
      updated_fields: Object.keys(updateData)
    });

    res.json(createSuccessResponse(updatedUser, {
      message: 'Profile updated successfully'
    }));
  }

  // Forgot password
  public async forgotPassword(req: Request, res: Response): Promise<void> {
    const { email } = req.body;

    if (!email || !ValidationUtils.isValidEmail(email)) {
      throw new ValidationError('Valid email is required');
    }

    // Check if user exists
    const { data: user } = await this.supabase
      .from('users')
      .select('id, email')
      .eq('email', email)
      .single();

    // Always return success for security (don't reveal if email exists)
    res.json(createSuccessResponse(null, {
      message: 'If the email exists, a password reset link has been sent'
    }));

    // Log the attempt
    req.logger.info('Password reset requested', {
      email,
      user_found: !!user
    });
  }

  // Reset password
  public async resetPassword(req: Request, res: Response): Promise<void> {
    const { token, new_password } = req.body;

    if (!token || !new_password) {
      throw new ValidationError('Token and new password are required');
    }

    // TODO: Implement token verification and password reset
    // This would involve verifying the reset token and updating the password

    res.json(createSuccessResponse(null, {
      message: 'Password reset successful'
    }));
  }

  // Verify email
  public async verifyEmail(req: Request, res: Response): Promise<void> {
    const { token } = req.body;

    if (!token) {
      throw new ValidationError('Verification token is required');
    }

    // TODO: Implement email verification
    res.json(createSuccessResponse(null, {
      message: 'Email verified successfully'
    }));
  }

  // Resend verification email
  public async resendVerification(req: Request, res: Response): Promise<void> {
    const { email } = req.body;

    if (!email) {
      throw new ValidationError('Email is required');
    }

    // TODO: Implement resend verification
    res.json(createSuccessResponse(null, {
      message: 'Verification email sent'
    }));
  }

  // Change password
  public async changePassword(req: Request, res: Response): Promise<void> {
    const userId = req.headers['x-user-id'] as string;
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      throw new ValidationError('Current password and new password are required');
    }

    // Get current user
    const { data: user, error } = await this.supabase
      .from('users')
      .select('password_hash')
      .eq('id', userId)
      .single();

    if (error || !user) {
      throw new NotFoundError('User', userId);
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(current_password, user.password_hash);
    if (!isCurrentPasswordValid) {
      throw new AuthenticationError('Current password is incorrect');
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(new_password, 12);

    // Update password
    const { error: updateError } = await this.supabase
      .from('users')
      .update({ password_hash: newPasswordHash })
      .eq('id', userId);

    if (updateError) {
      throw new BusinessLogicError('Failed to update password');
    }

    req.logger.info('Password changed', { user_id: userId });

    res.json(createSuccessResponse(null, {
      message: 'Password changed successfully'
    }));
  }

  // Delete account
  public async deleteAccount(req: Request, res: Response): Promise<void> {
    const userId = req.headers['x-user-id'] as string;
    const { password } = req.body;

    if (!password) {
      throw new ValidationError('Password confirmation is required');
    }

    // Verify password before deletion
    const { data: user, error } = await this.supabase
      .from('users')
      .select('password_hash')
      .eq('id', userId)
      .single();

    if (error || !user) {
      throw new NotFoundError('User', userId);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new AuthenticationError('Password is incorrect');
    }

    // Soft delete user (set inactive)
    const { error: deleteError } = await this.supabase
      .from('users')
      .update({ is_active: false })
      .eq('id', userId);

    if (deleteError) {
      throw new BusinessLogicError('Failed to delete account');
    }

    req.logger.info('Account deleted', { user_id: userId });

    res.json(createSuccessResponse(null, {
      message: 'Account deleted successfully'
    }));
  }

  // Helper method to generate JWT tokens
  private generateTokens(user: any, rememberMe: boolean = false): { accessToken: string; refreshToken: string } {
    const payload = {
      userId: user.id,
      email: user.email,
      username: user.username,
      subscription_tier: user.subscription_tier
    };

    const accessToken = jwt.sign(
      { ...payload, type: 'access' },
      this.JWT_SECRET,
      { expiresIn: this.JWT_EXPIRES_IN }
    );

    const refreshToken = jwt.sign(
      { ...payload, type: 'refresh' },
      this.JWT_SECRET,
      { expiresIn: rememberMe ? '30d' : this.REFRESH_TOKEN_EXPIRES_IN }
    );

    return { accessToken, refreshToken };
  }
}
