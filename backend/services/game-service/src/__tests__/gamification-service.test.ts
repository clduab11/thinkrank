/**
 * Gamification Service - Test Suite
 *
 * Comprehensive tests for point calculation and scoring logic
 * @see Issue #4: MAJOR - Gamification Negative Point Calculation Bug
 */

import {
  calculatePoints,
  calculatePointsDetailed,
  calculatePointsWithDecay,
  GamificationService,
  DEFAULT_SCORING_CONFIG,
  ChallengeResult,
  ScoringResult
} from '../services/gamification-service';

describe('GamificationService - Point Calculation', () => {
  describe('calculatePoints', () => {
    describe('Within Time Limit', () => {
      it('should award full points when within time limit', () => {
        const points = calculatePoints(100, 50, 60);
        expect(points).toBe(100);
      });

      it('should award full points when exactly at time limit', () => {
        const points = calculatePoints(100, 60, 60);
        expect(points).toBe(100);
      });

      it('should award full points for very fast completion', () => {
        const points = calculatePoints(100, 10, 60);
        expect(points).toBe(100);
      });
    });

    describe('Overtime Penalties', () => {
      it('should penalize overtime proportionally', () => {
        // 20% over time (72s / 60s = 1.2x)
        const points = calculatePoints(100, 72, 60);

        expect(points).toBeLessThan(100);
        expect(points).toBeGreaterThan(70);
        expect(points).toBe(80); // 20% penalty = 80 points
      });

      it('should apply 50% penalty for 50% overtime', () => {
        const points = calculatePoints(100, 90, 60);
        expect(points).toBe(50); // 50% penalty = 50 points
      });

      it('should apply 100% penalty (to minimum) for 100% overtime', () => {
        const points = calculatePoints(100, 120, 60);
        expect(points).toBe(10); // Hits minimum (10%)
      });
    });

    describe('Negative Score Prevention', () => {
      it('should never return negative points', () => {
        const points = calculatePoints(100, 600, 60);
        expect(points).toBeGreaterThanOrEqual(0);
      });

      it('should enforce minimum point threshold', () => {
        const points = calculatePoints(100, 1000, 60);
        expect(points).toBeGreaterThanOrEqual(10); // 10% minimum
      });

      it('should return minimum for extreme overtime', () => {
        const points1 = calculatePoints(100, 600, 60);
        const points2 = calculatePoints(100, 6000, 60);

        expect(points1).toBe(10); // Minimum
        expect(points2).toBe(10); // Also minimum
      });
    });

    describe('Penalty Capping', () => {
      it('should cap penalty at maximum (90%)', () => {
        const points1 = calculatePoints(100, 600, 60);
        const points2 = calculatePoints(100, 6000, 60);

        // Both should hit minimum despite vastly different times
        expect(points1).toBe(points2);
        expect(points1).toBe(10);
      });

      it('should not exceed 90% penalty even with huge overtime', () => {
        const points = calculatePoints(100, 10000, 60);
        expect(points).toBe(10); // 90% penalty = 10 points remaining
      });
    });

    describe('Edge Cases', () => {
      it('should handle zero time taken', () => {
        const points = calculatePoints(100, 0, 60);
        expect(points).toBe(100);
      });

      it('should handle very small time limits', () => {
        const points = calculatePoints(100, 2, 1);
        expect(points).toBeLessThan(100);
        expect(points).toBeGreaterThanOrEqual(10);
      });

      it('should handle very large base points', () => {
        const points = calculatePoints(10000, 50, 60);
        expect(points).toBe(10000);
      });

      it('should handle very large base points with overtime', () => {
        const points = calculatePoints(10000, 120, 60);
        expect(points).toBe(1000); // 10% minimum
      });

      it('should throw error for negative base points', () => {
        expect(() => calculatePoints(-100, 50, 60)).toThrow('Base points must be positive');
      });

      it('should throw error for negative time taken', () => {
        expect(() => calculatePoints(100, -50, 60)).toThrow('Time taken cannot be negative');
      });

      it('should throw error for zero time limit', () => {
        expect(() => calculatePoints(100, 50, 0)).toThrow('Time limit must be positive');
      });

      it('should throw error for negative time limit', () => {
        expect(() => calculatePoints(100, 50, -60)).toThrow('Time limit must be positive');
      });
    });

    describe('Custom Configuration', () => {
      it('should use custom minimum percentage', () => {
        const points = calculatePoints(100, 600, 60, {
          minPointsPercentage: 0.2 // 20% minimum
        });

        expect(points).toBe(20);
      });

      it('should use custom maximum penalty', () => {
        const points = calculatePoints(100, 600, 60, {
          maxPenaltyPercentage: 0.5 // 50% max penalty
        });

        expect(points).toBe(50); // Can't lose more than 50%
      });

      it('should use both custom min and max', () => {
        const points = calculatePoints(100, 600, 60, {
          minPointsPercentage: 0.25,
          maxPenaltyPercentage: 0.75
        });

        expect(points).toBe(25); // 75% penalty = 25 points
      });
    });
  });

  describe('calculatePointsDetailed', () => {
    it('should provide detailed breakdown for perfect completion', () => {
      const result = calculatePointsDetailed(100, 50, 60);

      expect(result.points).toBe(100);
      expect(result.basePoints).toBe(100);
      expect(result.penalty).toBe(0);
      expect(result.overtime).toBe(false);
      expect(result.timePercentage).toBeCloseTo(83.33, 1);
      expect(result.breakdown.timeTaken).toBe(50);
      expect(result.breakdown.timeLimit).toBe(60);
    });

    it('should provide detailed breakdown for overtime', () => {
      const result = calculatePointsDetailed(100, 90, 60);

      expect(result.points).toBe(50);
      expect(result.basePoints).toBe(100);
      expect(result.penalty).toBe(50);
      expect(result.overtime).toBe(true);
      expect(result.timePercentage).toBe(150);
      expect(result.breakdown.penaltyRatio).toBe(0.5);
    });

    it('should show minimum threshold in breakdown', () => {
      const result = calculatePointsDetailed(100, 600, 60);

      expect(result.points).toBe(10);
      expect(result.breakdown.minPoints).toBe(10);
    });
  });

  describe('calculatePointsWithDecay', () => {
    it('should award full points when within time limit', () => {
      const points = calculatePointsWithDecay(100, 50, 60);
      expect(points).toBe(100);
    });

    it('should apply exponential decay for overtime', () => {
      const points = calculatePointsWithDecay(100, 90, 60);

      expect(points).toBeLessThan(100);
      expect(points).toBeGreaterThanOrEqual(10);
    });

    it('should be more forgiving than linear for slight overtime', () => {
      const linear = calculatePoints(100, 72, 60);
      const decay = calculatePointsWithDecay(100, 72, 60);

      expect(decay).toBeGreaterThanOrEqual(linear);
    });

    it('should enforce minimum threshold', () => {
      const points = calculatePointsWithDecay(100, 6000, 60);
      expect(points).toBe(10);
    });

    it('should use custom decay rate', () => {
      const points1 = calculatePointsWithDecay(100, 120, 60, 0.1);
      const points2 = calculatePointsWithDecay(100, 120, 60, 0.5);

      expect(points2).toBeLessThan(points1); // Higher decay rate = more penalty
    });
  });

  describe('Point Distribution Fairness', () => {
    it('should have smooth, monotonically decreasing point curve', () => {
      const timeLimit = 60;
      const testCases = [60, 70, 90, 120, 180, 300, 600];
      const points = testCases.map(time => calculatePoints(100, time, timeLimit));

      // Points should decrease monotonically
      for (let i = 1; i < points.length; i++) {
        expect(points[i]).toBeLessThanOrEqual(points[i - 1]);
      }
    });

    it('should be fair across different base points', () => {
      const timeTaken = 90;
      const timeLimit = 60;

      const ratio1 = calculatePoints(100, timeTaken, timeLimit) / 100;
      const ratio2 = calculatePoints(500, timeTaken, timeLimit) / 500;
      const ratio3 = calculatePoints(1000, timeTaken, timeLimit) / 1000;

      // Ratios should be the same (fair scaling)
      expect(ratio1).toBeCloseTo(ratio2, 2);
      expect(ratio2).toBeCloseTo(ratio3, 2);
    });
  });

  describe('GamificationService Class', () => {
    describe('scoreChallenge', () => {
      it('should score completed challenge within time limit', () => {
        const service = new GamificationService();
        const result: ChallengeResult = {
          challengeId: 'challenge-1',
          userId: 'user-1',
          timeTaken: 50,
          timeLimit: 60,
          completed: true,
          completedAt: new Date()
        };

        const scoring = service.scoreChallenge(result);

        expect(scoring.points).toBe(100);
        expect(scoring.overtime).toBe(false);
      });

      it('should score completed challenge with overtime', () => {
        const service = new GamificationService();
        const result: ChallengeResult = {
          challengeId: 'challenge-1',
          userId: 'user-1',
          timeTaken: 90,
          timeLimit: 60,
          completed: true,
          completedAt: new Date()
        };

        const scoring = service.scoreChallenge(result);

        expect(scoring.points).toBe(50);
        expect(scoring.overtime).toBe(true);
      });

      it('should award zero points for incomplete challenge', () => {
        const service = new GamificationService();
        const result: ChallengeResult = {
          challengeId: 'challenge-1',
          userId: 'user-1',
          timeTaken: 50,
          timeLimit: 60,
          completed: false,
          completedAt: new Date()
        };

        const scoring = service.scoreChallenge(result);

        expect(scoring.points).toBe(0);
      });
    });

    describe('Configuration Management', () => {
      it('should use default configuration', () => {
        const service = new GamificationService();
        const config = service.getConfig();

        expect(config.basePoints).toBe(100);
        expect(config.minPointsPercentage).toBe(0.1);
        expect(config.maxPenaltyPercentage).toBe(0.9);
      });

      it('should use custom configuration', () => {
        const service = new GamificationService({
          basePoints: 200,
          minPointsPercentage: 0.2,
          maxPenaltyPercentage: 0.8
        });
        const config = service.getConfig();

        expect(config.basePoints).toBe(200);
        expect(config.minPointsPercentage).toBe(0.2);
        expect(config.maxPenaltyPercentage).toBe(0.8);
      });

      it('should update configuration', () => {
        const service = new GamificationService();
        service.updateConfig({ basePoints: 150 });

        const config = service.getConfig();
        expect(config.basePoints).toBe(150);
      });
    });

    describe('Multiple Results', () => {
      it('should score multiple challenges', () => {
        const service = new GamificationService();
        const results: ChallengeResult[] = [
          {
            challengeId: 'c1',
            userId: 'u1',
            timeTaken: 50,
            timeLimit: 60,
            completed: true,
            completedAt: new Date()
          },
          {
            challengeId: 'c2',
            userId: 'u1',
            timeTaken: 90,
            timeLimit: 60,
            completed: true,
            completedAt: new Date()
          }
        ];

        const scores = service.scoreMultiple(results);

        expect(scores).toHaveLength(2);
        expect(scores[0].points).toBe(100);
        expect(scores[1].points).toBe(50);
      });

      it('should calculate total points', () => {
        const service = new GamificationService();
        const results: ChallengeResult[] = [
          {
            challengeId: 'c1',
            userId: 'u1',
            timeTaken: 50,
            timeLimit: 60,
            completed: true,
            completedAt: new Date()
          },
          {
            challengeId: 'c2',
            userId: 'u1',
            timeTaken: 90,
            timeLimit: 60,
            completed: true,
            completedAt: new Date()
          },
          {
            challengeId: 'c3',
            userId: 'u1',
            timeTaken: 70,
            timeLimit: 60,
            completed: true,
            completedAt: new Date()
          }
        ];

        const total = service.getTotalPoints(results);

        // 100 + 50 + 83 = 233 (approximately)
        expect(total).toBeGreaterThan(200);
        expect(total).toBeLessThan(250);
      });
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle beginner difficulty (longer time limits)', () => {
      const points = calculatePoints(100, 150, 120);
      expect(points).toBeGreaterThan(70); // Forgiving for beginners
    });

    it('should handle expert difficulty (strict time limits)', () => {
      const points = calculatePoints(100, 35, 30);
      expect(points).toBeLessThan(100);
      expect(points).toBeGreaterThanOrEqual(10);
    });

    it('should handle practice mode (no time pressure)', () => {
      const points = calculatePoints(100, 500, 300);
      expect(points).toBeGreaterThanOrEqual(10); // Still get some points
    });

    it('should handle timed challenge (strict penalty)', () => {
      const points = calculatePoints(100, 61, 60);
      expect(points).toBeLessThan(100);
      expect(points).toBeGreaterThan(95); // Small penalty for 1 second over
    });
  });
});
