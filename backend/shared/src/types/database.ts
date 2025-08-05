// Database entity types for ThinkRank
// These types correspond to the database schema

export type SubscriptionTier = 'free' | 'premium' | 'pro';
export type ProblemType = 'bias_detection' | 'alignment' | 'context_evaluation';
export type ValidationStatus = 'pending' | 'validated' | 'rejected';
export type SocialInteractionType = 'like' | 'comment' | 'share' | 'follow';

// Base entity interface
export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at: string;
}

// User entity
export interface User extends BaseEntity {
  email: string;
  username: string;
  password_hash: string;
  subscription_tier: SubscriptionTier;
  profile_data: Record<string, unknown>;
  preferences: Record<string, unknown>;
  is_active: boolean;
  email_verified: boolean;
  last_login_at?: string;
}

// Public user profile (without sensitive data)
export interface UserProfile {
  id: string;
  username: string;
  subscription_tier: SubscriptionTier;
  profile_data: {
    displayName?: string;
    avatar?: string;
    bio?: string;
  };
  created_at: string;
}

// Subscription entity
export interface Subscription extends BaseEntity {
  user_id: string;
  tier_type: SubscriptionTier;
  start_date: string;
  end_date?: string;
  auto_renewal: boolean;
  stripe_subscription_id?: string;
  stripe_customer_id?: string;
  status: string;
  metadata: Record<string, unknown>;
}

// Game progress entity
export interface GameProgress extends BaseEntity {
  user_id: string;
  level: number;
  total_score: number;
  experience_points: number;
  completed_challenges: string[];
  skill_assessments: Record<string, number>;
  achievements: string[];
  current_streak: number;
  best_streak: number;
  last_activity: string;
}

// AI research problem entity
export interface AIResearchProblem extends BaseEntity {
  problem_id: string;
  institution_id?: string;
  institution_name?: string;
  problem_type: ProblemType;
  title: string;
  description?: string;
  difficulty_level: number;
  problem_data: Record<string, unknown>;
  validation_criteria: Record<string, unknown>;
  expected_solution_format: Record<string, unknown>;
  tags: string[];
  metadata: Record<string, unknown>;
  active: boolean;
  total_contributions: number;
  quality_threshold: number;
}

// Research contribution entity
export interface ResearchContribution extends BaseEntity {
  contribution_id: string;
  user_id: string;
  problem_id: string;
  solution_data: Record<string, unknown>;
  validation_status: ValidationStatus;
  quality_score?: number;
  confidence_score?: number;
  time_spent_seconds?: number;
  submission_method: string;
  peer_reviews: Record<string, unknown>[];
  research_impact: Record<string, unknown>;
  feedback_received: Record<string, unknown>;
  points_awarded: number;
  submitted_at: string;
  validated_at?: string;
}

// Social interaction entity
export interface SocialInteraction extends BaseEntity {
  user_id: string;
  target_user_id: string;
  interaction_type: SocialInteractionType;
  target_type?: string;
  target_id?: string;
  content?: string;
  metadata: Record<string, unknown>;
}

// Game session entity
export interface GameSession extends BaseEntity {
  user_id: string;
  session_token: string;
  start_time: string;
  end_time?: string;
  duration_seconds?: number;
  problems_attempted: number;
  problems_completed: number;
  total_score: number;
  average_response_time?: number;
  platform?: string;
  app_version?: string;
  device_info: Record<string, unknown>;
  session_data: Record<string, unknown>;
}

// Analytics event entity
export interface AnalyticsEvent {
  id: string;
  user_id?: string;
  session_id?: string;
  event_type: string;
  event_name: string;
  event_data: Record<string, unknown>;
  platform?: string;
  app_version?: string;
  user_agent?: string;
  ip_address?: string;
  created_at: string;
}

// Database query options
export interface QueryOptions {
  limit?: number;
  offset?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  filters?: Record<string, unknown>;
}

// Pagination result
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}
