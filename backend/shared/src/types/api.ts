// API request and response types for ThinkRank
import {
  SubscriptionTier,
  UserProfile
} from './database';

// Standard API Response wrapper
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    timestamp: string;
    request_id: string;
    version: string;
  };
}

// Authentication types
export interface LoginRequest {
  email: string;
  password: string;
  remember_me?: boolean;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  confirm_password: string;
  terms_accepted: boolean;
}

export interface AuthResponse {
  user: UserProfile;
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirmRequest {
  token: string;
  new_password: string;
}

// User management types
export interface UpdateProfileRequest {
  profile_data?: {
    displayName?: string;
    avatar?: string;
    bio?: string;
  };
  preferences?: {
    notifications?: boolean;
    privacy?: 'public' | 'friends' | 'private';
    theme?: 'light' | 'dark';
  };
}

export interface UserStatsResponse {
  total_score: number;
  level: number;
  achievements_count: number;
  contributions_count: number;
  validation_rate: number;
  rank: number;
  streak: number;
}

// Game types
export interface StartGameSessionRequest {
  platform: string;
  app_version: string;
  device_info: Record<string, unknown>;
}

export interface UpdateGameSessionRequest {
  problems_attempted?: number;
  problems_completed?: number;
  total_score?: number;
  session_data?: Record<string, unknown>;
}

export interface EndGameSessionRequest {
  final_score: number;
  problems_completed: number;
  session_data: Record<string, unknown>;
}

export interface GameProgressUpdateRequest {
  level?: number;
  experience_points?: number;
  completed_challenges?: string[];
  skill_assessments?: Record<string, number>;
  achievements?: string[];
}

export interface LeaderboardEntry {
  user: UserProfile;
  score: number;
  level: number;
  rank: number;
  achievements_count: number;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  user_rank?: number;
  total_players: number;
  time_period: 'daily' | 'weekly' | 'monthly' | 'all_time';
}

// AI Research types
export interface SubmitSolutionRequest {
  problem_id: string;
  solution_data: Record<string, unknown>;
  confidence_score: number;
  time_spent_seconds: number;
}

export interface ResearchProblemFilters {
  problem_type?: string;
  difficulty_level?: number;
  institution_id?: string;
  tags?: string[];
  active_only?: boolean;
}

export interface ContributionFilters {
  user_id?: string;
  problem_id?: string;
  validation_status?: string;
  min_quality_score?: number;
  date_from?: string;
  date_to?: string;
}

export interface ResearchInsight {
  problem_id: string;
  total_contributions: number;
  average_quality_score: number;
  validation_rate: number;
  top_contributors: UserProfile[];
  insights: string[];
}

// Social types
export interface FollowUserRequest {
  target_user_id: string;
}

export interface CreateCommentRequest {
  target_type: string;
  target_id: string;
  content: string;
}

export interface ShareAchievementRequest {
  achievement_id: string;
  platform: 'twitter' | 'linkedin' | 'facebook';
  message?: string;
}

export interface SocialFeedEntry {
  id: string;
  user: UserProfile;
  action_type: 'achievement' | 'contribution' | 'level_up' | 'streak';
  content: Record<string, unknown>;
  likes_count: number;
  comments_count: number;
  created_at: string;
  user_liked?: boolean;
}

export interface SocialStats {
  followers_count: number;
  following_count: number;
  likes_received: number;
  contributions_shared: number;
}

// Analytics types
export interface TrackEventRequest {
  event_type: string;
  event_name: string;
  event_data: Record<string, unknown>;
  session_id?: string;
}

export interface AnalyticsQuery {
  event_types?: string[];
  user_id?: string;
  session_id?: string;
  date_from?: string;
  date_to?: string;
  aggregation?: 'count' | 'sum' | 'avg' | 'unique';
  group_by?: string;
}

export interface AnalyticsResult {
  metric: string;
  value: number;
  breakdown?: Record<string, number>;
  time_series?: Array<{
    timestamp: string;
    value: number;
  }>;
}

// Subscription types
export interface SubscriptionPlan {
  tier: SubscriptionTier;
  name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  features: string[];
  limits: {
    daily_problems?: number;
    advanced_analytics?: boolean;
    priority_support?: boolean;
    research_collaboration?: boolean;
  };
}

export interface CreateSubscriptionRequest {
  tier: SubscriptionTier;
  payment_method_id: string;
  billing_period: 'monthly' | 'yearly';
}

export interface UpdateSubscriptionRequest {
  tier?: SubscriptionTier;
  auto_renewal?: boolean;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'paypal';
  last_four?: string;
  brand?: string;
  exp_month?: number;
  exp_year?: number;
  is_default: boolean;
}

export interface BillingHistory {
  id: string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed';
  invoice_url?: string;
  created_at: string;
}

// Error types
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  validation_errors?: ValidationError[];
}

// Webhook types
export interface WebhookEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
  created_at: string;
  signature: string;
}

// File upload types
export interface UploadRequest {
  file_type: 'avatar' | 'attachment' | 'research_data';
  file_name: string;
  content_type: string;
  file_size: number;
}

export interface UploadResponse {
  upload_url: string;
  file_id: string;
  expires_at: string;
}

// Health check types
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    database: 'healthy' | 'unhealthy';
    redis: 'healthy' | 'unhealthy';
    external_apis: 'healthy' | 'unhealthy';
  };
}

// Export utility types
export type ApiRequest<T = unknown> = T;
export type ApiHandler<TRequest = unknown, TResponse = unknown> = (
  req: TRequest
) => Promise<ApiResponse<TResponse>>;
