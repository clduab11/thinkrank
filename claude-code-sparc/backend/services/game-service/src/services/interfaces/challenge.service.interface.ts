import type { Challenge, GameMode } from '../../types/game.types';

export interface IChallengeService {
  generateChallenges(mode: GameMode, userId: string): Promise<Challenge[]>;
  validateAnswer(challengeId: string, answer: boolean): Promise<boolean>;
}