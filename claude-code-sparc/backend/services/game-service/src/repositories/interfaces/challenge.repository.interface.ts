import type { Challenge } from '../../types/game.types';

export interface IChallengeRepository {
  findById(id: string): Promise<Challenge | null>;
  findByDifficulty(minDifficulty: number, maxDifficulty: number, limit: number): Promise<Challenge[]>;
  findRandom(count: number, filters?: ChallengeFilters): Promise<Challenge[]>;
  create(challenge: Omit<Challenge, 'id'>): Promise<Challenge>;
}

export interface ChallengeFilters {
  minDifficulty?: number;
  maxDifficulty?: number;
  type?: 'text' | 'image';
}