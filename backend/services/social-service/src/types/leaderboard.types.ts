// Leaderboard type definitions for better type safety

// Database record types from leaderboard queries
export interface LeaderboardEntry {
  user_id: string;
  username: string;
  total_score: number;
  level: number;
  profile_data?: {
    displayName?: string;
    avatar?: string;
  };
}

export interface UserContribution {
  user_id: string;
  problem_id: string;
  quality_score: number;
  points_awarded: number;
  submitted_at: string;
  problem_type?: string;
  validation_status?: string;
}

export interface CategoryLeaderboardEntry {
  user_id: string;
  username: string;
  category_score: number;
  contribution_count: number;
  profile_data?: {
    displayName?: string;
    avatar?: string;
  };
}

// Leaderboard response types
export interface FormattedLeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  displayName?: string;
  avatar?: string;
  score: number;
  level?: number;
  streak?: number;
  achievements_count?: number;
}

export interface CategoryRankResult {
  category: string;
  rank: number;
  totalUsers: number;
  score: number;
}

// Leaderboard configuration
export interface LeaderboardConfig {
  category?: string;
  timeframe?: 'daily' | 'weekly' | 'monthly' | 'all_time';
  limit?: number;
  includeUserData?: boolean;
}

// Helper interfaces for complex calculations
export interface UserScoreBreakdown {
  user_id: string;
  totalScore: number;
  contributionCount: number;
  averageQuality: number;
  categories: Record<string, number>;
}