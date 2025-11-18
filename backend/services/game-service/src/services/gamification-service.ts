/**
 * Gamification Service
 *
 * Handles game mechanics, point calculation, and scoring logic for the ThinkRank platform.
 * Implements fair, motivating scoring with configurable bounds to prevent negative scores.
 *
 * Features:
 * - Time-based point calculation with penalties for overtime
 * - Minimum point threshold (10% of base points)
 * - Maximum penalty cap (90% of base points)
 * - Multiple scoring algorithms (linear, exponential decay)
 * - Configurable scoring parameters
 *
 * @see Issue #4: MAJOR - Gamification Negative Point Calculation Bug
 * @created 2024-11-16
 */

/**
 * Scoring configuration interface
 */
export interface ScoringConfig {
  /** Base points awarded for perfect completion */
  basePoints: number;
  /** Minimum points as percentage of base (0.1 = 10%) */
  minPointsPercentage: number;
  /** Maximum penalty as percentage of base (0.9 = 90%) */
  maxPenaltyPercentage: number;
}

/**
 * Default scoring configuration
 * - Base: 100 points
 * - Minimum: 10% (10 points)
 * - Max Penalty: 90% (lose up to 90 points)
 */
export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  basePoints: 100,
  minPointsPercentage: 0.1,
  maxPenaltyPercentage: 0.9
};

/**
 * Challenge completion result
 */
export interface ChallengeResult {
  /** Unique challenge identifier */
  challengeId: string;
  /** User identifier */
  userId: string;
  /** Time taken to complete (seconds) */
  timeTaken: number;
  /** Time limit for the challenge (seconds) */
  timeLimit: number;
  /** Whether challenge was completed successfully */
  completed: boolean;
  /** Timestamp of completion */
  completedAt: Date;
}

/**
 * Scoring result with detailed breakdown
 */
export interface ScoringResult {
  /** Final calculated points */
  points: number;
  /** Base points before any modifications */
  basePoints: number;
  /** Time penalty applied */
  penalty: number;
  /** Whether time limit was exceeded */
  overtime: boolean;
  /** Percentage of time limit used */
  timePercentage: number;
  /** Breakdown of calculation */
  breakdown: {
    timeTaken: number;
    timeLimit: number;
    penaltyRatio: number;
    minPoints: number;
  };
}

/**
 * Calculate points for a timed challenge
 *
 * Uses percentage-based scoring with minimum/maximum bounds to ensure
 * fair, motivating scores that never go negative.
 *
 * Algorithm:
 * 1. Full points if within time limit
 * 2. Linear penalty based on time overage ratio
 * 3. Penalty capped at maxPenaltyPercentage (default 90%)
 * 4. Final score clamped to minimum threshold (default 10%)
 *
 * @param basePoints - Maximum points for perfect completion
 * @param timeTaken - Actual time taken in seconds
 * @param timeLimit - Time limit in seconds
 * @param config - Optional scoring configuration
 * @returns Calculated points (never negative)
 *
 * @example
 * ```typescript
 * // Perfect completion
 * calculatePoints(100, 50, 60) // Returns: 100
 *
 * // Slight overtime (20%)
 * calculatePoints(100, 72, 60) // Returns: 80
 *
 * // Significant overtime
 * calculatePoints(100, 180, 60) // Returns: 10 (minimum)
 * ```
 */
export function calculatePoints(
  basePoints: number,
  timeTaken: number,
  timeLimit: number,
  config: Partial<ScoringConfig> = {}
): number {
  // Merge with defaults
  const finalConfig: ScoringConfig = {
    ...DEFAULT_SCORING_CONFIG,
    ...config,
    basePoints // Override basePoints with parameter
  };

  // Validate inputs
  if (basePoints <= 0) {
    throw new Error('Base points must be positive');
  }
  if (timeTaken < 0) {
    throw new Error('Time taken cannot be negative');
  }
  if (timeLimit <= 0) {
    throw new Error('Time limit must be positive');
  }

  // Full points if within time limit
  if (timeTaken <= timeLimit) {
    return basePoints;
  }

  // Calculate time overage as ratio
  const overageRatio = (timeTaken - timeLimit) / timeLimit;

  // Calculate penalty (capped at max penalty percentage)
  const penaltyRatio = Math.min(overageRatio, finalConfig.maxPenaltyPercentage);
  const penalty = basePoints * penaltyRatio;

  // Calculate final points
  const points = basePoints - penalty;

  // Ensure minimum points threshold
  const minPoints = basePoints * finalConfig.minPointsPercentage;

  // Return floored value, clamped to minimum
  return Math.max(Math.floor(points), Math.floor(minPoints));
}

/**
 * Calculate points with detailed breakdown
 *
 * Provides full scoring details for analytics and debugging
 *
 * @param basePoints - Maximum points for perfect completion
 * @param timeTaken - Actual time taken in seconds
 * @param timeLimit - Time limit in seconds
 * @param config - Optional scoring configuration
 * @returns Detailed scoring result
 */
export function calculatePointsDetailed(
  basePoints: number,
  timeTaken: number,
  timeLimit: number,
  config: Partial<ScoringConfig> = {}
): ScoringResult {
  const finalConfig: ScoringConfig = {
    ...DEFAULT_SCORING_CONFIG,
    ...config,
    basePoints
  };

  const overtime = timeTaken > timeLimit;
  const timePercentage = (timeTaken / timeLimit) * 100;

  let penalty = 0;
  let penaltyRatio = 0;

  if (overtime) {
    const overageRatio = (timeTaken - timeLimit) / timeLimit;
    penaltyRatio = Math.min(overageRatio, finalConfig.maxPenaltyPercentage);
    penalty = basePoints * penaltyRatio;
  }

  const points = calculatePoints(basePoints, timeTaken, timeLimit, config);
  const minPoints = basePoints * finalConfig.minPointsPercentage;

  return {
    points,
    basePoints,
    penalty,
    overtime,
    timePercentage,
    breakdown: {
      timeTaken,
      timeLimit,
      penaltyRatio,
      minPoints
    }
  };
}

/**
 * Calculate points using exponential decay
 *
 * Alternative scoring algorithm that's more forgiving for slight overages
 * but still enforces minimum threshold.
 *
 * @param basePoints - Maximum points for perfect completion
 * @param timeTaken - Actual time taken in seconds
 * @param timeLimit - Time limit in seconds
 * @param decayRate - Rate of exponential decay (default 0.1)
 * @returns Calculated points using exponential decay
 */
export function calculatePointsWithDecay(
  basePoints: number,
  timeTaken: number,
  timeLimit: number,
  decayRate = 0.1
): number {
  // Validate inputs
  if (basePoints <= 0) {
    throw new Error('Base points must be positive');
  }
  if (timeTaken < 0) {
    throw new Error('Time taken cannot be negative');
  }
  if (timeLimit <= 0) {
    throw new Error('Time limit must be positive');
  }

  // Full points if within time limit
  if (timeTaken <= timeLimit) {
    return basePoints;
  }

  const overageSeconds = timeTaken - timeLimit;

  // Exponential decay: points = basePoints * e^(-decayRate * overage)
  const decayFactor = Math.exp(-decayRate * (overageSeconds / timeLimit));
  const points = basePoints * decayFactor;

  // Minimum 10% of base points
  const minPoints = basePoints * 0.1;

  return Math.max(Math.floor(points), Math.floor(minPoints));
}

/**
 * Gamification Service Class
 *
 * Main service for handling gamification logic
 */
export class GamificationService {
  private config: ScoringConfig;

  constructor(config: Partial<ScoringConfig> = {}) {
    this.config = {
      ...DEFAULT_SCORING_CONFIG,
      ...config
    };
  }

  /**
   * Calculate score for a challenge result
   *
   * @param result - Challenge completion result
   * @returns Detailed scoring result
   */
  scoreChallenge(result: ChallengeResult): ScoringResult {
    if (!result.completed) {
      // No points for incomplete challenges
      return {
        points: 0,
        basePoints: this.config.basePoints,
        penalty: this.config.basePoints,
        overtime: true,
        timePercentage: 0,
        breakdown: {
          timeTaken: result.timeTaken,
          timeLimit: result.timeLimit,
          penaltyRatio: 1,
          minPoints: 0
        }
      };
    }

    return calculatePointsDetailed(
      this.config.basePoints,
      result.timeTaken,
      result.timeLimit,
      this.config
    );
  }

  /**
   * Get scoring configuration
   */
  getConfig(): ScoringConfig {
    return { ...this.config };
  }

  /**
   * Update scoring configuration
   */
  updateConfig(config: Partial<ScoringConfig>): void {
    this.config = {
      ...this.config,
      ...config
    };
  }

  /**
   * Calculate points for multiple results
   *
   * @param results - Array of challenge results
   * @returns Array of scoring results
   */
  scoreMultiple(results: ChallengeResult[]): ScoringResult[] {
    return results.map(result => this.scoreChallenge(result));
  }

  /**
   * Get total points from multiple results
   *
   * @param results - Array of challenge results
   * @returns Total points earned
   */
  getTotalPoints(results: ChallengeResult[]): number {
    return this.scoreMultiple(results).reduce(
      (total, result) => total + result.points,
      0
    );
  }
}

/**
 * Export singleton instance with default configuration
 */
export const gamificationService = new GamificationService();
