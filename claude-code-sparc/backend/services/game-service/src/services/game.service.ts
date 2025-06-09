import type { IGameRepository } from '../repositories/interfaces/game.repository.interface';
import type { IChallengeService } from './interfaces/challenge.service.interface';
import type { IScoreService } from './interfaces/score.service.interface';
import type { ICacheService } from './interfaces/cache.service.interface';
import type {
  CreateGameDto,
  SubmitAnswerDto,
  GameSession,
  GameResult,
  Challenge,
} from '../types/game.types';

export class GameService {
  constructor(
    private readonly gameRepository: IGameRepository,
    private readonly challengeService: IChallengeService,
    private readonly scoreService: IScoreService,
    private readonly cacheService: ICacheService
  ) {}

  async createGame(dto: CreateGameDto): Promise<{ gameId: string; challenges: any[] }> {
    const challenges = await this.challengeService.generateChallenges(dto.mode, dto.userId);

    const game = await this.gameRepository.create({
      userId: dto.userId,
      mode: dto.mode,
      challengeIds: challenges.map(c => c.id),
    });

    const gameSession: GameSession = {
      gameId: game.id,
      userId: dto.userId,
      mode: dto.mode,
      currentChallengeIndex: 0,
      challenges,
      responses: [],
      score: 0,
      streak: 0,
      startTime: Date.now(),
    };

    await this.cacheService.set(`game:${game.id}`, gameSession, 3600);

    return {
      gameId: game.id,
      challenges: challenges.map(c => ({
        id: c.id,
        type: c.type,
        content: c.content,
      })),
    };
  }

  async submitAnswer(gameId: string, dto: SubmitAnswerDto): Promise<any> {
    const gameSession = await this.cacheService.get<GameSession>(`game:${gameId}`);
    if (!gameSession) {
      throw new Error('Game not found or expired');
    }

    const challenge = gameSession.challenges.find(c => c.id === dto.challengeId);
    if (!challenge) {
      throw new Error('Challenge not found in this game');
    }

    const isCorrect = await this.challengeService.validateAnswer(dto.challengeId, dto.answer);

    const scoreCalculation = this.scoreService.calculateScore({
      isCorrect,
      timeSpent: dto.timeSpent,
      difficulty: challenge.difficulty,
      streak: gameSession.streak,
    });

    const response = {
      challengeId: dto.challengeId,
      userAnswer: dto.answer,
      isCorrect,
      timeSpent: dto.timeSpent,
      scoreEarned: scoreCalculation.totalScore,
    };

    gameSession.responses.push(response);
    gameSession.currentChallengeIndex++;
    gameSession.score += scoreCalculation.totalScore;
    gameSession.streak = isCorrect ? gameSession.streak + 1 : 0;

    await this.gameRepository.saveResponse({ ...response, gameId });
    await this.cacheService.set(`game:${gameId}`, gameSession, 3600);

    const feedback = this.generateFeedback(challenge, isCorrect);

    return {
      correct: isCorrect,
      score: scoreCalculation.totalScore,
      totalScore: gameSession.score,
      streak: gameSession.streak,
      feedback,
    };
  }

  async completeGame(gameId: string): Promise<GameResult> {
    const game = await this.gameRepository.findById(gameId);
    if (!game) {
      throw new Error('Game not found');
    }

    if (game.status === 'completed') {
      throw new Error('Game already completed');
    }

    const gameSession = await this.cacheService.get<GameSession>(`game:${gameId}`);
    if (!gameSession) {
      throw new Error('Game session not found');
    }

    const correctAnswers = gameSession.responses.filter(r => r.isCorrect).length;
    const totalChallenges = gameSession.challenges.length;
    const accuracy = totalChallenges > 0 ? correctAnswers / totalChallenges : 0;
    const completedAt = new Date();
    const durationSeconds = Math.floor((completedAt.getTime() - game.startedAt.getTime()) / 1000);

    await this.gameRepository.update(gameId, {
      status: 'completed',
      score: gameSession.score,
      accuracy,
      completedAt,
      durationSeconds,
    });

    await this.scoreService.updateLeaderboard(game.userId, gameSession.score, gameSession.mode);
    await this.cacheService.delete(`game:${gameId}`);

    const averageTimePerChallenge = gameSession.responses.length > 0
      ? gameSession.responses.reduce((sum, r) => sum + r.timeSpent, 0) / gameSession.responses.length
      : 0;

    const longestStreak = this.calculateLongestStreak(gameSession.responses);

    return {
      gameId,
      totalScore: gameSession.score,
      accuracy,
      totalChallenges,
      correctAnswers,
      averageTimePerChallenge,
      longestStreak,
    };
  }

  async getGameState(gameId: string): Promise<any> {
    const gameSession = await this.cacheService.get<GameSession>(`game:${gameId}`);
    if (!gameSession) {
      return null;
    }

    const currentChallenge = gameSession.challenges[gameSession.currentChallengeIndex];
    const timeElapsed = Math.floor((Date.now() - gameSession.startTime) / 1000);

    return {
      gameId,
      currentChallenge: currentChallenge ? {
        id: currentChallenge.id,
        type: currentChallenge.type,
        content: currentChallenge.content,
      } : null,
      currentChallengeIndex: gameSession.currentChallengeIndex,
      totalChallenges: gameSession.challenges.length,
      score: gameSession.score,
      streak: gameSession.streak,
      timeElapsed,
    };
  }

  private generateFeedback(challenge: Challenge, isCorrect: boolean): string {
    if (isCorrect) {
      return 'Correct! Great job spotting the AI-generated content.';
    } else {
      return `Incorrect. This content was ${challenge.isAiGenerated ? 'AI-generated' : 'human-written'}.`;
    }
  }

  private calculateLongestStreak(responses: any[]): number {
    let longestStreak = 0;
    let currentStreak = 0;

    for (const response of responses) {
      if (response.isCorrect) {
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    return longestStreak;
  }
}