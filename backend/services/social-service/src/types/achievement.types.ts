// Achievement type definitions for better type safety

// Achievement requirement metadata for different types
export interface ScoreRequirementMetadata {
  gameMode?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  timeframe?: 'daily' | 'weekly' | 'monthly' | 'all_time';
}

export interface ContributionRequirementMetadata {
  problemTypes?: string[];
  qualityThreshold?: number;
  institutionTypes?: string[];
}

export interface StreakRequirementMetadata {
  activityType: 'daily_login' | 'daily_contribution' | 'daily_problem_solving';
  consecutiveDays: number;
}

export interface LevelRequirementMetadata {
  skillAreas?: string[];
  overallLevel?: boolean;
}

export interface ResearchQualityRequirementMetadata {
  averageScore: number;
  minimumContributions: number;
  peerReviewScore?: number;
}

export interface SocialRequirementMetadata {
  activityType: 'followers' | 'likes_received' | 'comments' | 'shares';
  timeframe?: 'daily' | 'weekly' | 'monthly' | 'all_time';
}

// Union type for all possible requirement metadata
export type RequirementMetadata =
  | ScoreRequirementMetadata
  | ContributionRequirementMetadata
  | StreakRequirementMetadata
  | LevelRequirementMetadata
  | ResearchQualityRequirementMetadata
  | SocialRequirementMetadata
  | Record<string, unknown>;

// Achievement reward value types
export interface BadgeReward {
  badgeId: string;
  badgeName: string;
  badgeImageUrl?: string;
}

export interface PointsReward {
  points: number;
  bonusMultiplier?: number;
}

export interface TitleReward {
  titleId: string;
  titleName: string;
  titleColor?: string;
  titleIcon?: string;
}

// Union type for all possible reward values
export type RewardValue = BadgeReward | PointsReward | TitleReward | string | number;

// Type guards for requirement metadata
export function isScoreRequirementMetadata(metadata: unknown): metadata is ScoreRequirementMetadata {
  return (
    typeof metadata === 'object' &&
    metadata !== null &&
    ('gameMode' in metadata || 'difficulty' in metadata || 'timeframe' in metadata)
  );
}

export function isContributionRequirementMetadata(metadata: unknown): metadata is ContributionRequirementMetadata {
  return (
    typeof metadata === 'object' &&
    metadata !== null &&
    ('problemTypes' in metadata || 'qualityThreshold' in metadata || 'institutionTypes' in metadata)
  );
}

export function isStreakRequirementMetadata(metadata: unknown): metadata is StreakRequirementMetadata {
  return (
    typeof metadata === 'object' &&
    metadata !== null &&
    'activityType' in metadata &&
    'consecutiveDays' in metadata
  );
}

// Type guards for reward values
export function isBadgeReward(value: unknown): value is BadgeReward {
  return (
    typeof value === 'object' &&
    value !== null &&
    'badgeId' in value &&
    'badgeName' in value
  );
}

export function isPointsReward(value: unknown): value is PointsReward {
  return (
    typeof value === 'object' &&
    value !== null &&
    'points' in value &&
    typeof (value as any).points === 'number'
  );
}

export function isTitleReward(value: unknown): value is TitleReward {
  return (
    typeof value === 'object' &&
    value !== null &&
    'titleId' in value &&
    'titleName' in value
  );
}