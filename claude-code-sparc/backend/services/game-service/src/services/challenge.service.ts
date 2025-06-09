import type { IChallengeService } from './interfaces/challenge.service.interface';
import type { IChallengeRepository } from '../repositories/interfaces/challenge.repository.interface';
import type { Challenge, GameMode } from '../types/game.types';

export class ChallengeService implements IChallengeService {
  private readonly MODE_CONFIGS = {
    'quick-play': {
      count: 5,
      minDifficulty: 0.3,
      maxDifficulty: 0.7,
    },
    'daily-challenge': {
      count: 7,
      minDifficulty: 0.4,
      maxDifficulty: 0.8,
    },
    'research-mode': {
      count: 20,
      minDifficulty: 0.3,
      maxDifficulty: 0.9,
    },
    'tournament': {
      count: 10,
      minDifficulty: 0.6,
      maxDifficulty: 0.9,
    },
  };

  constructor(private readonly challengeRepository: IChallengeRepository) {}

  async generateChallenges(mode: GameMode, _userId: string): Promise<Challenge[]> {
    const config = this.MODE_CONFIGS[mode];
    
    const challenges = await this.challengeRepository.findRandom(config.count, {
      minDifficulty: config.minDifficulty,
      maxDifficulty: config.maxDifficulty,
    });

    return challenges;
  }

  async validateAnswer(challengeId: string, answer: boolean): Promise<boolean> {
    const challenge = await this.challengeRepository.findById(challengeId);
    
    if (!challenge) {
      throw new Error('Challenge not found');
    }

    return challenge.isAiGenerated === answer;
  }
}