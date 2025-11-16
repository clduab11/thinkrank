# [MINOR] Mock Data Generator Hardcoded Percentiles

## Labels
`minor`, `testing`, `test-utils`, `technical-debt`, `pr-9`

## Priority
🔵 **MINOR** - Low priority

## Description
Mock data generator uses hardcoded percentile calculations instead of configurable parameters, limiting test flexibility and coverage.

## Current Behavior
```typescript
// ❌ Hardcoded percentile
function generateMockLeaderboard() {
  const percentile = 75; // Fixed value
  return generateScores(percentile);
}
```

## Expected Behavior
```typescript
// ✅ Configurable percentile
function generateMockLeaderboard(config: LeaderboardConfig = {}) {
  const { percentile = 75, size = 100, distribution = 'normal' } = config;
  return generateScores(percentile, size, distribution);
}
```

## Impact
- **Severity:** LOW
- **Testing:** Limited test coverage for edge cases
- **Flexibility:** Cannot test different distributions
- **Maintenance:** Duplicate code for different scenarios

## Files Affected
- `backend/tests/utils/mock-data-generator.ts`
- Test files using mock data generation

## Proposed Solution

### 1. Create Configurable Generator
```typescript
// backend/tests/utils/mock-data-generator.ts

export interface LeaderboardConfig {
  /** Number of entries to generate */
  size?: number;
  /** Target percentile for test user (0-100) */
  percentile?: number;
  /** Score distribution type */
  distribution?: 'normal' | 'uniform' | 'pareto' | 'exponential';
  /** Minimum score value */
  minScore?: number;
  /** Maximum score value */
  maxScore?: number;
  /** Random seed for reproducibility */
  seed?: number;
}

const DEFAULT_CONFIG: Required<LeaderboardConfig> = {
  size: 100,
  percentile: 75,
  distribution: 'normal',
  minScore: 0,
  maxScore: 1000,
  seed: Date.now()
};

export class MockDataGenerator {
  private rng: SeededRandom;

  constructor(seed?: number) {
    this.rng = new SeededRandom(seed);
  }

  /**
   * Generate mock leaderboard data
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
      userId: `user_${index}`,
      username: `Player${index}`,
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
   * Normal (Gaussian) distribution
   */
  private generateNormalDistribution(
    size: number,
    min: number,
    max: number
  ): number[] {
    const mean = (min + max) / 2;
    const stdDev = (max - min) / 6; // 99.7% within range

    return Array.from({ length: size }, () => {
      const u1 = this.rng.random();
      const u2 = this.rng.random();

      // Box-Muller transform
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const score = mean + z * stdDev;

      return Math.max(min, Math.min(max, score));
    }).sort((a, b) => b - a); // Descending order
  }

  /**
   * Uniform distribution
   */
  private generateUniformDistribution(
    size: number,
    min: number,
    max: number
  ): number[] {
    return Array.from({ length: size }, () =>
      min + this.rng.random() * (max - min)
    ).sort((a, b) => b - a);
  }

  /**
   * Pareto distribution (80-20 rule)
   */
  private generateParetoDistribution(
    size: number,
    min: number,
    max: number
  ): number[] {
    const alpha = 1.5; // Shape parameter

    return Array.from({ length: size }, () => {
      const u = this.rng.random();
      const score = min / Math.pow(u, 1 / alpha);
      return Math.min(max, score);
    }).sort((a, b) => b - a);
  }

  /**
   * Exponential distribution
   */
  private generateExponentialDistribution(
    size: number,
    min: number,
    max: number
  ): number[] {
    const lambda = 1 / ((max - min) / 3);

    return Array.from({ length: size }, () => {
      const u = this.rng.random();
      const score = min - Math.log(1 - u) / lambda;
      return Math.min(max, score);
    }).sort((a, b) => b - a);
  }

  /**
   * Calculate percentile for a rank
   */
  private calculatePercentile(rank: number, total: number): number {
    return Math.round(((total - rank) / total) * 100);
  }

  /**
   * Find entry at specific percentile
   */
  findAtPercentile(
    entries: LeaderboardEntry[],
    targetPercentile: number
  ): LeaderboardEntry {
    const targetRank = Math.floor(
      (1 - targetPercentile / 100) * entries.length
    );
    return entries[targetRank];
  }
}

/**
 * Seeded random number generator for reproducible tests
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  random(): number {
    // Linear congruential generator
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
}

// Export singleton for convenience
export const mockDataGenerator = new MockDataGenerator();

// Export factory function
export function createMockDataGenerator(seed?: number): MockDataGenerator {
  return new MockDataGenerator(seed);
}
```

### 2. Usage Examples
```typescript
// backend/services/game-service/__tests__/leaderboard.test.ts

import { mockDataGenerator, createMockDataGenerator } from '@tests/utils/mock-data-generator';

describe('Leaderboard Service', () => {
  describe('Normal distribution', () => {
    it('should rank users correctly', () => {
      const leaderboard = mockDataGenerator.generateLeaderboard({
        size: 100,
        distribution: 'normal',
        percentile: 90 // Test high performer
      });

      expect(leaderboard).toHaveLength(100);
      expect(leaderboard[0].rank).toBe(1);
      expect(leaderboard[0].percentile).toBeGreaterThan(90);
    });
  });

  describe('Pareto distribution (80-20 rule)', () => {
    it('should reflect realistic score distribution', () => {
      const leaderboard = mockDataGenerator.generateLeaderboard({
        size: 100,
        distribution: 'pareto'
      });

      // Top 20% should have 80% of the range
      const top20 = leaderboard.slice(0, 20);
      const bottom80 = leaderboard.slice(20);

      const top20Range = top20[0].score - top20[19].score;
      const bottom80Range = bottom80[0].score - bottom80[79].score;

      expect(top20Range).toBeGreaterThan(bottom80Range * 3);
    });
  });

  describe('Reproducible tests with seed', () => {
    it('should generate same data with same seed', () => {
      const gen1 = createMockDataGenerator(12345);
      const gen2 = createMockDataGenerator(12345);

      const data1 = gen1.generateLeaderboard({ size: 50 });
      const data2 = gen2.generateLeaderboard({ size: 50 });

      expect(data1).toEqual(data2);
    });
  });

  describe('Edge cases', () => {
    it('should handle extreme percentiles', () => {
      const leaderboard = mockDataGenerator.generateLeaderboard({
        size: 1000,
        percentile: 99.9 // Top 0.1%
      });

      const topUser = mockDataGenerator.findAtPercentile(leaderboard, 99.9);
      expect(topUser.rank).toBeLessThan(10);
    });

    it('should handle small leaderboards', () => {
      const leaderboard = mockDataGenerator.generateLeaderboard({
        size: 5
      });

      expect(leaderboard).toHaveLength(5);
      expect(leaderboard[0].rank).toBe(1);
    });
  });
});
```

### 3. Test Coverage for Different Scenarios
```typescript
// Test different distributions
describe('Distribution coverage', () => {
  const scenarios = [
    { distribution: 'normal', description: 'bell curve' },
    { distribution: 'uniform', description: 'even spread' },
    { distribution: 'pareto', description: '80-20 rule' },
    { distribution: 'exponential', description: 'decay curve' }
  ] as const;

  scenarios.forEach(({ distribution, description }) => {
    it(`should generate ${description} distribution`, () => {
      const leaderboard = mockDataGenerator.generateLeaderboard({
        size: 1000,
        distribution
      });

      expect(leaderboard).toHaveLength(1000);
      expect(leaderboard[0].score).toBeGreaterThan(leaderboard[999].score);
    });
  });
});
```

## Acceptance Criteria
- [ ] Create configurable mock data generator class
- [ ] Implement multiple distribution types (normal, uniform, Pareto, exponential)
- [ ] Add seeded random number generator for reproducibility
- [ ] Add percentile calculation utilities
- [ ] Update all existing tests to use new generator
- [ ] Add comprehensive unit tests for generator
- [ ] Document configuration options
- [ ] Add usage examples to documentation

## Benefits
1. **Better Test Coverage:** Test edge cases and distributions
2. **Reproducible Tests:** Seeded RNG for consistent results
3. **Realistic Data:** Multiple distributions match real-world scenarios
4. **Flexibility:** Easy to test different scenarios
5. **Maintainability:** Single source of truth for mock data

## Migration Path
```typescript
// Before
const leaderboard = generateMockLeaderboard();

// After
const leaderboard = mockDataGenerator.generateLeaderboard({
  size: 100,
  percentile: 75,
  distribution: 'normal'
});
```

## Estimated Effort
1 hour

## Related Issues
- PR #9: Repository analysis
- Testing infrastructure improvements

## References
- Statistical Distributions: https://en.wikipedia.org/wiki/Probability_distribution
- Box-Muller Transform: https://en.wikipedia.org/wiki/Box%E2%80%93Muller_transform
- Pareto Principle: https://en.wikipedia.org/wiki/Pareto_principle
