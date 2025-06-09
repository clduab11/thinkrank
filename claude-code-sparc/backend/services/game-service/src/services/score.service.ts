import type Redis from 'ioredis';
import type { IScoreService, ScoreParams } from './interfaces/score.service.interface';
import type { GameMode, ScoreCalculation } from '../types/game.types';

export class ScoreService implements IScoreService {
  private readonly BASE_SCORE = 100;
  private readonly TIME_LIMIT = 30; // seconds
  private readonly STREAK_MULTIPLIER = 10;
  private readonly STREAK_MAX = 100;

  constructor(private readonly redis: Redis) {}

  calculateScore(params: ScoreParams): ScoreCalculation {
    if (!params.isCorrect) {
      return {
        baseScore: 0,
        timeBonus: 0,
        streakBonus: 0,
        difficultyMultiplier: 1.0,
        totalScore: 0,
        xpGained: 0,
      };
    }

    const baseScore = this.BASE_SCORE;
    
    // Time bonus: faster = more points
    const timeBonus = Math.max(0, (this.TIME_LIMIT - params.timeSpent) * 2);
    
    // Streak bonus
    const streakBonus = Math.min(params.streak * this.STREAK_MULTIPLIER, this.STREAK_MAX);
    
    // Difficulty multiplier
    const difficultyMultiplier = 1 + (params.difficulty - 0.5);
    
    // Calculate total
    const totalScore = Math.round(
      (baseScore + timeBonus + streakBonus) * difficultyMultiplier
    );
    
    // XP calculation
    const xpGained = Math.floor(totalScore / 10);

    return {
      baseScore,
      timeBonus,
      streakBonus,
      difficultyMultiplier,
      totalScore,
      xpGained,
    };
  }

  async updateLeaderboard(userId: string, score: number, mode: GameMode): Promise<void> {
    try {
      const pipeline = this.redis.pipeline();
      
      // Update various leaderboards
      pipeline.zadd('leaderboard:global', score, userId);
      pipeline.zadd('leaderboard:daily', score, userId);
      pipeline.zadd('leaderboard:weekly', score, userId);
      pipeline.zadd(`leaderboard:mode:${mode}`, score, userId);
      
      await pipeline.exec();
    } catch (error) {
      throw new Error('Failed to update leaderboard');
    }
  }
}