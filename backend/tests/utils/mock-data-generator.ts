/**
 * Mock Data Generator
 *
 * Configurable test data generator with multiple distribution types
 * and seeded random number generation for reproducible tests.
 *
 * @see Issue #8: MINOR - Mock Data Generator Hardcoded Percentiles
 * @created 2024-11-16
 */

/**
 * Leaderboard entry interface
 */
export interface LeaderboardEntry {
  userId: string;
  username: string;
  score: number;
  rank: number;
  percentile: number;
}

/**
 * Leaderboard configuration
 */
export interface LeaderboardConfig {
  /** Number of entries to generate (default: 100) */
  size?: number;
  /** Target percentile for test user 0-100 (default: 75) */
  percentile?: number;
  /** Score distribution type (default: 'normal') */
  distribution?: 'normal' | 'uniform' | 'pareto' | 'exponential';
  /** Minimum score value (default: 0) */
  minScore?: number;
  /** Maximum score value (default: 1000) */
  maxScore?: number;
  /** Random seed for reproducibility (default: Date.now()) */
  seed?: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<LeaderboardConfig> = {
  size: 100,
  percentile: 75,
  distribution: 'normal',
  minScore: 0,
  maxScore: 1000,
  seed: Date.now()
};

/**
 * Seeded random number generator for reproducible tests
 *
 * Uses linear congruential generator algorithm
 */
export class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed % 2147483647;
    if (this.seed <= 0) this.seed += 2147483646;
  }

  /**
   * Generate next random number [0, 1)
   */
  random(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }

  /**
   * Generate random integer in range [min, max]
   */
  randomInt(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }
}

/**
 * Mock Data Generator
 *
 * Generates realistic test data with configurable distributions
 * and reproducible results using seeded random number generation.
 *
 * @example
 * ```typescript
 * import { mockDataGenerator, createMockDataGenerator } from '@tests/utils/mock-data-generator';
 *
 * // Use default singleton
 * const leaderboard = mockDataGenerator.generateLeaderboard({
 *   size: 100,
 *   distribution: 'normal',
 *   percentile: 90
 * });
 *
 * // Create reproducible generator
 * const gen = createMockDataGenerator(12345);
 * const data = gen.generateLeaderboard({ size: 50 });
 * ```
 */
export class MockDataGenerator {
  private rng: SeededRandom;

  constructor(seed?: number) {
    this.rng = new SeededRandom(seed || Date.now());
  }

  /**
   * Generate mock leaderboard data
   *
   * @param config - Leaderboard configuration
   * @returns Array of leaderboard entries sorted by rank
   */
  generateLeaderboard(config: LeaderboardConfig = {}): LeaderboardEntry[] {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };

    // Generate scores based on distribution
    const scores = this.generateDistribution(
      finalConfig.size,
      finalConfig.distribution,
      finalConfig.minScore,
      finalConfig.maxScore
    );

    // Create leaderboard entries
    return scores.map((score, index) => ({
      userId: `user_${index + 1}`,
      username: `Player${index + 1}`,
      score: Math.floor(score),
      rank: index + 1,
      percentile: this.calculatePercentile(index, scores.length)
    }));
  }

  /**
   * Generate scores based on distribution type
   */
  private generateDistribution(
    size: number,
    type: LeaderboardConfig['distribution'],
    min: number,
    max: number
  ): number[] {
    switch (type) {
      case 'normal':
        return this.generateNormalDistribution(size, min, max);
      case 'uniform':
        return this.generateUniformDistribution(size, min, max);
      case 'pareto':
        return this.generateParetoDistribution(size, min, max);
      case 'exponential':
        return this.generateExponentialDistribution(size, min, max);
      default:
        return this.generateNormalDistribution(size, min, max);
    }
  }

  /**
   * Normal (Gaussian) distribution using Box-Muller transform
   */
  private generateNormalDistribution(size: number, min: number, max: number): number[] {
    const mean = (min + max) / 2;
    const stdDev = (max - min) / 6; // 99.7% within range (3 sigma rule)

    const scores: number[] = [];

    for (let i = 0; i < size; i++) {
      const u1 = this.rng.random();
      const u2 = this.rng.random();

      // Box-Muller transform
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const score = mean + z * stdDev;

      // Clamp to range
      scores.push(Math.max(min, Math.min(max, score)));
    }

    return scores.sort((a, b) => b - a); // Descending order
  }

  /**
   * Uniform distribution - all values equally likely
   */
  private generateUniformDistribution(size: number, min: number, max: number): number[] {
    return Array.from({ length: size }, () => min + this.rng.random() * (max - min)).sort(
      (a, b) => b - a
    );
  }

  /**
   * Pareto distribution (80-20 rule)
   * Models real-world scenarios where top 20% have 80% of value
   */
  private generateParetoDistribution(size: number, min: number, max: number): number[] {
    const alpha = 1.16; // Shape parameter (closer to 1 = more inequality)
    const xm = min; // Minimum value

    return Array.from({ length: size }, () => {
      const u = this.rng.random();
      const score = xm / Math.pow(1 - u, 1 / alpha);
      return Math.min(max, score);
    }).sort((a, b) => b - a);
  }

  /**
   * Exponential distribution - decay curve
   * Models time-based or decay scenarios
   */
  private generateExponentialDistribution(size: number, min: number, max: number): number[] {
    const lambda = 1 / ((max - min) / 3);

    return Array.from({ length: size }, () => {
      const u = this.rng.random();
      const score = min - Math.log(1 - u) / lambda;
      return Math.min(max, score);
    }).sort((a, b) => b - a);
  }

  /**
   * Calculate percentile for a rank
   *
   * @param rank - Rank (0-indexed)
   * @param total - Total number of entries
   * @returns Percentile (0-100)
   */
  private calculatePercentile(rank: number, total: number): number {
    return Math.round(((total - rank - 1) / total) * 100);
  }

  /**
   * Find entry at specific percentile
   *
   * @param entries - Leaderboard entries
   * @param targetPercentile - Target percentile (0-100)
   * @returns Entry at or near the target percentile
   */
  findAtPercentile(entries: LeaderboardEntry[], targetPercentile: number): LeaderboardEntry {
    const targetRank = Math.floor((1 - targetPercentile / 100) * entries.length);
    return entries[Math.max(0, Math.min(entries.length - 1, targetRank))];
  }

  /**
   * Generate user data at specific percentile
   *
   * @param config - Leaderboard configuration
   * @returns Leaderboard with highlighted user at target percentile
   */
  generateWithUserAtPercentile(config: LeaderboardConfig = {}): {
    leaderboard: LeaderboardEntry[];
    targetUser: LeaderboardEntry;
  } {
    const leaderboard = this.generateLeaderboard(config);
    const targetUser = this.findAtPercentile(leaderboard, config.percentile || 75);

    return {
      leaderboard,
      targetUser
    };
  }
}

/**
 * Singleton instance for convenience
 */
export const mockDataGenerator = new MockDataGenerator();

/**
 * Factory function to create generator with specific seed
 *
 * @param seed - Random seed for reproducibility
 * @returns MockDataGenerator instance
 */
export function createMockDataGenerator(seed?: number): MockDataGenerator {
  return new MockDataGenerator(seed);
}
