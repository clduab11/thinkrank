import type { GameMode, ScoreCalculation } from '../../types/game.types';

export interface IScoreService {
  calculateScore(params: ScoreParams): ScoreCalculation;
  updateLeaderboard(userId: string, score: number, mode: GameMode): Promise<void>;
}

export interface ScoreParams {
  isCorrect: boolean;
  timeSpent: number;
  difficulty: number;
  streak: number;
}