import { ScoreService } from '../../services/score.service';
import type { ScoreParams } from '../../services/interfaces/score.service.interface';
import type Redis from 'ioredis';

jest.mock('ioredis');

describe('ScoreService', () => {
  let scoreService: ScoreService;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    mockRedis = {
      zadd: jest.fn(),
      zrevrank: jest.fn(),
      pipeline: jest.fn().mockReturnThis(),
      exec: jest.fn(),
    } as any;

    scoreService = new ScoreService(mockRedis);
  });

  describe('calculateScore', () => {
    it('should calculate score for correct answer with time bonus', () => {
      const params: ScoreParams = {
        isCorrect: true,
        timeSpent: 10,
        difficulty: 0.5,
        streak: 0,
      };

      const result = scoreService.calculateScore(params);

      expect(result).toEqual({
        baseScore: 100,
        timeBonus: 40, // MAX(0, (30 - 10) * 2)
        streakBonus: 0,
        difficultyMultiplier: 1.0, // 1 + (0.5 - 0.5)
        totalScore: 140, // (100 + 40 + 0) * 1.0
        xpGained: 14, // FLOOR(140 / 10)
      });
    });

    it('should calculate score with streak bonus', () => {
      const params: ScoreParams = {
        isCorrect: true,
        timeSpent: 15,
        difficulty: 0.6,
        streak: 5,
      };

      const result = scoreService.calculateScore(params);

      expect(result).toEqual({
        baseScore: 100,
        timeBonus: 30, // MAX(0, (30 - 15) * 2)
        streakBonus: 50, // MIN(5 * 10, 100)
        difficultyMultiplier: 1.1, // 1 + (0.6 - 0.5)
        totalScore: 198, // (100 + 30 + 50) * 1.1
        xpGained: 19,
      });
    });

    it('should cap streak bonus at maximum', () => {
      const params: ScoreParams = {
        isCorrect: true,
        timeSpent: 5,
        difficulty: 0.8,
        streak: 15, // High streak
      };

      const result = scoreService.calculateScore(params);

      expect(result.streakBonus).toBe(100); // Capped at 100
    });

    it('should return zero score for incorrect answer', () => {
      const params: ScoreParams = {
        isCorrect: false,
        timeSpent: 10,
        difficulty: 0.5,
        streak: 3,
      };

      const result = scoreService.calculateScore(params);

      expect(result).toEqual({
        baseScore: 0,
        timeBonus: 0,
        streakBonus: 0,
        difficultyMultiplier: 1.0,
        totalScore: 0,
        xpGained: 0,
      });
    });

    it('should handle slow response with no time bonus', () => {
      const params: ScoreParams = {
        isCorrect: true,
        timeSpent: 35, // Slower than 30 seconds
        difficulty: 0.5,
        streak: 0,
      };

      const result = scoreService.calculateScore(params);

      expect(result.timeBonus).toBe(0);
      expect(result.totalScore).toBe(100); // Base score only
    });

    it('should apply difficulty multiplier correctly', () => {
      const params: ScoreParams = {
        isCorrect: true,
        timeSpent: 20,
        difficulty: 0.9, // High difficulty
        streak: 2,
      };

      const result = scoreService.calculateScore(params);

      expect(result.difficultyMultiplier).toBe(1.4); // 1 + (0.9 - 0.5)
      expect(result.totalScore).toBe(196); // (100 + 20 + 20) * 1.4
    });
  });

  describe('updateLeaderboard', () => {
    it('should update global and mode-specific leaderboards', async () => {
      const userId = 'user-123';
      const score = 1500;
      const mode = 'quick-play';

      const mockPipeline = {
        zadd: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };

      mockRedis.pipeline.mockReturnValue(mockPipeline as any);

      await scoreService.updateLeaderboard(userId, score, mode);

      expect(mockRedis.pipeline).toHaveBeenCalled();
      expect(mockPipeline.zadd).toHaveBeenCalledWith(
        'leaderboard:global',
        score,
        userId
      );
      expect(mockPipeline.zadd).toHaveBeenCalledWith(
        'leaderboard:daily',
        score,
        userId
      );
      expect(mockPipeline.zadd).toHaveBeenCalledWith(
        'leaderboard:weekly',
        score,
        userId
      );
      expect(mockPipeline.zadd).toHaveBeenCalledWith(
        `leaderboard:mode:${mode}`,
        score,
        userId
      );
      expect(mockPipeline.exec).toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      const userId = 'user-123';
      const score = 1500;
      const mode = 'quick-play';

      const mockPipeline = {
        zadd: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(new Error('Redis error')),
      };

      mockRedis.pipeline.mockReturnValue(mockPipeline as any);

      await expect(
        scoreService.updateLeaderboard(userId, score, mode)
      ).rejects.toThrow('Failed to update leaderboard');
    });
  });
});