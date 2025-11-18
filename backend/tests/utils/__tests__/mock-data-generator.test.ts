/**
 * MockDataGenerator - Test Suite
 *
 * Comprehensive tests for configurable test data generation
 * @see Issue #8: MINOR - Mock Data Generator Hardcoded Percentiles
 */

import {
  MockDataGenerator,
  createMockDataGenerator,
  mockDataGenerator,
  SeededRandom,
  LeaderboardEntry
} from '../mock-data-generator';

describe('MockDataGenerator', () => {
  describe('SeededRandom', () => {
    it('should generate consistent random numbers with same seed', () => {
      const rng1 = new SeededRandom(12345);
      const rng2 = new SeededRandom(12345);

      const values1 = Array.from({ length: 10 }, () => rng1.random());
      const values2 = Array.from({ length: 10 }, () => rng2.random());

      expect(values1).toEqual(values2);
    });

    it('should generate different numbers with different seeds', () => {
      const rng1 = new SeededRandom(111);
      const rng2 = new SeededRandom(222);

      const value1 = rng1.random();
      const value2 = rng2.random();

      expect(value1).not.toBe(value2);
    });

    it('should generate numbers in range [0, 1)', () => {
      const rng = new SeededRandom(42);

      for (let i = 0; i < 100; i++) {
        const value = rng.random();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    });

    it('should generate integers in specified range', () => {
      const rng = new SeededRandom(42);

      for (let i = 0; i < 50; i++) {
        const value = rng.randomInt(1, 10);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(10);
        expect(Number.isInteger(value)).toBe(true);
      }
    });
  });

  describe('generateLeaderboard', () => {
    it('should generate leaderboard with default configuration', () => {
      const generator = new MockDataGenerator(12345);
      const leaderboard = generator.generateLeaderboard();

      expect(leaderboard).toHaveLength(100);
      expect(leaderboard[0].rank).toBe(1);
      expect(leaderboard[99].rank).toBe(100);
    });

    it('should generate custom size leaderboard', () => {
      const generator = new MockDataGenerator();
      const leaderboard = generator.generateLeaderboard({ size: 50 });

      expect(leaderboard).toHaveLength(50);
    });

    it('should sort scores in descending order', () => {
      const generator = new MockDataGenerator();
      const leaderboard = generator.generateLeaderboard({ size: 20 });

      for (let i = 1; i < leaderboard.length; i++) {
        expect(leaderboard[i].score).toBeLessThanOrEqual(leaderboard[i - 1].score);
      }
    });

    it('should calculate percentiles correctly', () => {
      const generator = new MockDataGenerator();
      const leaderboard = generator.generateLeaderboard({ size: 100 });

      // Top player should be 99th percentile
      expect(leaderboard[0].percentile).toBeGreaterThan(95);

      // Bottom player should be 0th percentile
      expect(leaderboard[99].percentile).toBeLessThan(5);
    });

    it('should assign unique user IDs', () => {
      const generator = new MockDataGenerator();
      const leaderboard = generator.generateLeaderboard({ size: 50 });

      const userIds = leaderboard.map(e => e.userId);
      const uniqueIds = new Set(userIds);

      expect(uniqueIds.size).toBe(50);
    });

    it('should respect min and max score bounds', () => {
      const generator = new MockDataGenerator();
      const leaderboard = generator.generateLeaderboard({
        size: 100,
        minScore: 100,
        maxScore: 1000
      });

      leaderboard.forEach(entry => {
        expect(entry.score).toBeGreaterThanOrEqual(100);
        expect(entry.score).toBeLessThanOrEqual(1000);
      });
    });
  });

  describe('Distribution Types', () => {
    describe('Normal Distribution', () => {
      it('should generate normal distribution', () => {
        const generator = new MockDataGenerator(42);
        const leaderboard = generator.generateLeaderboard({
          size: 1000,
          distribution: 'normal',
          minScore: 0,
          maxScore: 1000
        });

        // Most scores should be near the mean (500)
        const mean = leaderboard.reduce((sum, e) => sum + e.score, 0) / leaderboard.length;

        expect(mean).toBeGreaterThan(400);
        expect(mean).toBeLessThan(600);
      });

      it('should have scores clustered around mean', () => {
        const generator = new MockDataGenerator(42);
        const leaderboard = generator.generateLeaderboard({
          size: 1000,
          distribution: 'normal'
        });

        const mean = leaderboard.reduce((sum, e) => sum + e.score, 0) / leaderboard.length;
        const stdDev = Math.sqrt(
          leaderboard.reduce((sum, e) => sum + Math.pow(e.score - mean, 2), 0) / leaderboard.length
        );

        // About 68% should be within 1 standard deviation
        const withinOneStdDev = leaderboard.filter(
          e => Math.abs(e.score - mean) <= stdDev
        ).length;

        expect(withinOneStdDev / leaderboard.length).toBeGreaterThan(0.6);
        expect(withinOneStdDev / leaderboard.length).toBeLessThan(0.75);
      });
    });

    describe('Uniform Distribution', () => {
      it('should generate uniform distribution', () => {
        const generator = new MockDataGenerator(42);
        const leaderboard = generator.generateLeaderboard({
          size: 1000,
          distribution: 'uniform',
          minScore: 0,
          maxScore: 1000
        });

        // Scores should be evenly distributed
        const bins = [0, 0, 0, 0, 0]; // 5 bins
        leaderboard.forEach(e => {
          const binIndex = Math.floor((e.score / 1000) * 5);
          bins[Math.min(binIndex, 4)]++;
        });

        // Each bin should have roughly 20% (200 ± 50)
        bins.forEach(count => {
          expect(count).toBeGreaterThan(150);
          expect(count).toBeLessThan(250);
        });
      });
    });

    describe('Pareto Distribution', () => {
      it('should generate Pareto distribution (80-20 rule)', () => {
        const generator = new MockDataGenerator(42);
        const leaderboard = generator.generateLeaderboard({
          size: 1000,
          distribution: 'pareto',
          minScore: 100,
          maxScore: 10000
        });

        // Top 20% should have significantly higher scores
        const top20 = leaderboard.slice(0, 200);
        const bottom80 = leaderboard.slice(200);

        const top20Avg = top20.reduce((sum, e) => sum + e.score, 0) / top20.length;
        const bottom80Avg = bottom80.reduce((sum, e) => sum + e.score, 0) / bottom80.length;

        expect(top20Avg).toBeGreaterThan(bottom80Avg * 2);
      });
    });

    describe('Exponential Distribution', () => {
      it('should generate exponential distribution', () => {
        const generator = new MockDataGenerator(42);
        const leaderboard = generator.generateLeaderboard({
          size: 1000,
          distribution: 'exponential'
        });

        // Should have decay curve (more low scores than high scores)
        const lowScores = leaderboard.filter(e => e.score < 333).length;
        const highScores = leaderboard.filter(e => e.score > 666).length;

        expect(lowScores).toBeGreaterThan(highScores);
      });
    });
  });

  describe('findAtPercentile', () => {
    it('should find entry at specific percentile', () => {
      const generator = new MockDataGenerator();
      const leaderboard = generator.generateLeaderboard({ size: 100 });

      const entry = generator.findAtPercentile(leaderboard, 90);

      expect(entry.percentile).toBeGreaterThan(85);
      expect(entry.percentile).toBeLessThanOrEqual(95);
    });

    it('should find top player at 99th percentile', () => {
      const generator = new MockDataGenerator();
      const leaderboard = generator.generateLeaderboard({ size: 100 });

      const topPlayer = generator.findAtPercentile(leaderboard, 99);

      expect(topPlayer.rank).toBeLessThan(5);
    });

    it('should find bottom player at 1st percentile', () => {
      const generator = new MockDataGenerator();
      const leaderboard = generator.generateLeaderboard({ size: 100 });

      const bottomPlayer = generator.findAtPercentile(leaderboard, 1);

      expect(bottomPlayer.rank).toBeGreaterThan(95);
    });
  });

  describe('generateWithUserAtPercentile', () => {
    it('should generate leaderboard with target user at percentile', () => {
      const generator = new MockDataGenerator();
      const { leaderboard, targetUser } = generator.generateWithUserAtPercentile({
        size: 100,
        percentile: 75
      });

      expect(leaderboard).toHaveLength(100);
      expect(targetUser.percentile).toBeGreaterThan(70);
      expect(targetUser.percentile).toBeLessThanOrEqual(80);
    });
  });

  describe('Reproducibility', () => {
    it('should generate same data with same seed', () => {
      const gen1 = createMockDataGenerator(12345);
      const gen2 = createMockDataGenerator(12345);

      const data1 = gen1.generateLeaderboard({ size: 50 });
      const data2 = gen2.generateLeaderboard({ size: 50 });

      expect(data1).toEqual(data2);
    });

    it('should generate different data with different seeds', () => {
      const gen1 = createMockDataGenerator(111);
      const gen2 = createMockDataGenerator(222);

      const data1 = gen1.generateLeaderboard({ size: 50 });
      const data2 = gen2.generateLeaderboard({ size: 50 });

      expect(data1).not.toEqual(data2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very small leaderboards', () => {
      const generator = new MockDataGenerator();
      const leaderboard = generator.generateLeaderboard({ size: 1 });

      expect(leaderboard).toHaveLength(1);
      expect(leaderboard[0].rank).toBe(1);
    });

    it('should handle very large leaderboards', () => {
      const generator = new MockDataGenerator();
      const leaderboard = generator.generateLeaderboard({ size: 10000 });

      expect(leaderboard).toHaveLength(10000);
      expect(leaderboard[0].rank).toBe(1);
      expect(leaderboard[9999].rank).toBe(10000);
    });

    it('should handle extreme percentiles', () => {
      const generator = new MockDataGenerator();
      const leaderboard = generator.generateLeaderboard({ size: 1000 });

      const top = generator.findAtPercentile(leaderboard, 99.9);
      const bottom = generator.findAtPercentile(leaderboard, 0.1);

      expect(top.rank).toBeLessThan(10);
      expect(bottom.rank).toBeGreaterThan(990);
    });

    it('should handle zero range (min === max)', () => {
      const generator = new MockDataGenerator();
      const leaderboard = generator.generateLeaderboard({
        size: 10,
        minScore: 100,
        maxScore: 100
      });

      leaderboard.forEach(entry => {
        expect(entry.score).toBe(100);
      });
    });
  });

  describe('Singleton Instance', () => {
    it('should provide singleton instance', () => {
      const data1 = mockDataGenerator.generateLeaderboard({ size: 10 });
      const data2 = mockDataGenerator.generateLeaderboard({ size: 10 });

      expect(data1).toHaveLength(10);
      expect(data2).toHaveLength(10);
      // Should generate different data (different internal seed state)
      expect(data1).not.toEqual(data2);
    });
  });

  describe('Factory Function', () => {
    it('should create generator with seed', () => {
      const generator = createMockDataGenerator(42);
      expect(generator).toBeInstanceOf(MockDataGenerator);
    });

    it('should create generator without seed', () => {
      const generator = createMockDataGenerator();
      expect(generator).toBeInstanceOf(MockDataGenerator);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should generate realistic game leaderboard', () => {
      const generator = createMockDataGenerator(42);
      const leaderboard = generator.generateLeaderboard({
        size: 100,
        distribution: 'pareto', // Realistic: few top players dominate
        minScore: 0,
        maxScore: 10000
      });

      expect(leaderboard).toHaveLength(100);
      expect(leaderboard[0].score).toBeGreaterThan(leaderboard[50].score * 2);
    });

    it('should generate exam scores (normal distribution)', () => {
      const generator = createMockDataGenerator(42);
      const scores = generator.generateLeaderboard({
        size: 30,
        distribution: 'normal',
        minScore: 0,
        maxScore: 100
      });

      const avg = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;

      // Should cluster around 50
      expect(avg).toBeGreaterThan(40);
      expect(avg).toBeLessThan(60);
    });
  });
});
