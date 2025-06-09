import { GameService } from '../../services/game.service';
import type { IGameRepository } from '../../repositories/interfaces/game.repository.interface';
import type { IChallengeService } from '../../services/interfaces/challenge.service.interface';
import type { IScoreService } from '../../services/interfaces/score.service.interface';
import type { ICacheService } from '../../services/interfaces/cache.service.interface';
import type { CreateGameDto, SubmitAnswerDto, Challenge, GameSession } from '../../types/game.types';

describe('GameService', () => {
  let gameService: GameService;
  let mockGameRepository: jest.Mocked<IGameRepository>;
  let mockChallengeService: jest.Mocked<IChallengeService>;
  let mockScoreService: jest.Mocked<IScoreService>;
  let mockCacheService: jest.Mocked<ICacheService>;

  beforeEach(() => {
    mockGameRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      findByUserId: jest.fn(),
      saveResponse: jest.fn(),
    };

    mockChallengeService = {
      generateChallenges: jest.fn(),
      validateAnswer: jest.fn(),
    };

    mockScoreService = {
      calculateScore: jest.fn(),
      updateLeaderboard: jest.fn(),
    };

    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
    };

    gameService = new GameService(
      mockGameRepository,
      mockChallengeService,
      mockScoreService,
      mockCacheService
    );
  });

  describe('createGame', () => {
    it('should create a new game with challenges', async () => {
      const createGameDto: CreateGameDto = {
        userId: 'user-123',
        mode: 'quick-play',
      };

      const challenges: Challenge[] = [
        {
          id: 'challenge-1',
          type: 'text',
          content: 'Is this AI generated text?',
          isAiGenerated: true,
          difficulty: 0.5,
        },
        {
          id: 'challenge-2',
          type: 'text',
          content: 'This is human written content.',
          isAiGenerated: false,
          difficulty: 0.6,
        },
      ];

      const newGame = {
        id: 'game-123',
        userId: createGameDto.userId,
        mode: createGameDto.mode,
        status: 'active' as const,
        score: 0,
        startedAt: new Date(),
      };

      mockChallengeService.generateChallenges.mockResolvedValue(challenges);
      mockGameRepository.create.mockResolvedValue(newGame);

      const result = await gameService.createGame(createGameDto);

      expect(mockChallengeService.generateChallenges).toHaveBeenCalledWith(
        createGameDto.mode,
        createGameDto.userId
      );
      expect(mockGameRepository.create).toHaveBeenCalledWith({
        userId: createGameDto.userId,
        mode: createGameDto.mode,
        challengeIds: challenges.map(c => c.id),
      });
      expect(mockCacheService.set).toHaveBeenCalledWith(
        `game:${newGame.id}`,
        expect.objectContaining({
          gameId: newGame.id,
          userId: createGameDto.userId,
          mode: createGameDto.mode,
          currentChallengeIndex: 0,
          challenges,
          responses: [],
          score: 0,
          streak: 0,
        }),
        3600
      );
      expect(result).toEqual({
        gameId: newGame.id,
        challenges: challenges.map(c => ({
          id: c.id,
          type: c.type,
          content: c.content,
        })),
      });
    });

    it('should throw error if challenge generation fails', async () => {
      const createGameDto: CreateGameDto = {
        userId: 'user-123',
        mode: 'quick-play',
      };

      mockChallengeService.generateChallenges.mockRejectedValue(
        new Error('Failed to generate challenges')
      );

      await expect(gameService.createGame(createGameDto)).rejects.toThrow(
        'Failed to generate challenges'
      );
      expect(mockGameRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('submitAnswer', () => {
    it('should process correct answer and update score', async () => {
      const gameId = 'game-123';
      const submitDto: SubmitAnswerDto = {
        challengeId: 'challenge-1',
        answer: true,
        timeSpent: 15,
      };

      const gameSession: GameSession = {
        gameId,
        userId: 'user-123',
        mode: 'quick-play',
        currentChallengeIndex: 0,
        challenges: [
          {
            id: 'challenge-1',
            type: 'text',
            content: 'Test content',
            isAiGenerated: true,
            difficulty: 0.5,
          },
        ],
        responses: [],
        score: 0,
        streak: 0,
        startTime: Date.now() - 20000,
      };

      const scoreCalculation = {
        baseScore: 100,
        timeBonus: 30,
        streakBonus: 0,
        difficultyMultiplier: 1.0,
        totalScore: 130,
        xpGained: 13,
      };

      mockCacheService.get.mockResolvedValue(gameSession);
      mockChallengeService.validateAnswer.mockResolvedValue(true);
      mockScoreService.calculateScore.mockReturnValue(scoreCalculation);

      const result = await gameService.submitAnswer(gameId, submitDto);

      expect(mockCacheService.get).toHaveBeenCalledWith(`game:${gameId}`);
      expect(mockChallengeService.validateAnswer).toHaveBeenCalledWith(
        submitDto.challengeId,
        submitDto.answer
      );
      expect(mockScoreService.calculateScore).toHaveBeenCalledWith({
        isCorrect: true,
        timeSpent: submitDto.timeSpent,
        difficulty: 0.5,
        streak: 0,
      });
      expect(mockGameRepository.saveResponse).toHaveBeenCalledWith({
        gameId,
        challengeId: submitDto.challengeId,
        userAnswer: submitDto.answer,
        isCorrect: true,
        timeSpent: submitDto.timeSpent,
        scoreEarned: scoreCalculation.totalScore,
      });
      expect(mockCacheService.set).toHaveBeenCalledWith(
        `game:${gameId}`,
        expect.objectContaining({
          currentChallengeIndex: 1,
          score: 130,
          streak: 1,
        }),
        3600
      );
      expect(result).toEqual({
        correct: true,
        score: scoreCalculation.totalScore,
        totalScore: 130,
        streak: 1,
        feedback: 'Correct! Great job spotting the AI-generated content.',
      });
    });

    it('should handle incorrect answer and reset streak', async () => {
      const gameId = 'game-123';
      const submitDto: SubmitAnswerDto = {
        challengeId: 'challenge-1',
        answer: false,
        timeSpent: 20,
      };

      const gameSession: GameSession = {
        gameId,
        userId: 'user-123',
        mode: 'quick-play',
        currentChallengeIndex: 0,
        challenges: [
          {
            id: 'challenge-1',
            type: 'text',
            content: 'Test content',
            isAiGenerated: true,
            difficulty: 0.5,
          },
        ],
        responses: [],
        score: 100,
        streak: 3,
        startTime: Date.now() - 30000,
      };

      const scoreCalculation = {
        baseScore: 0,
        timeBonus: 0,
        streakBonus: 0,
        difficultyMultiplier: 1.0,
        totalScore: 0,
        xpGained: 0,
      };

      mockCacheService.get.mockResolvedValue(gameSession);
      mockChallengeService.validateAnswer.mockResolvedValue(false);
      mockScoreService.calculateScore.mockReturnValue(scoreCalculation);

      const result = await gameService.submitAnswer(gameId, submitDto);

      expect(mockChallengeService.validateAnswer).toHaveBeenCalledWith(
        submitDto.challengeId,
        submitDto.answer
      );
      expect(mockScoreService.calculateScore).toHaveBeenCalledWith({
        isCorrect: false,
        timeSpent: submitDto.timeSpent,
        difficulty: 0.5,
        streak: 3,
      });
      expect(result).toEqual({
        correct: false,
        score: 0,
        totalScore: 100,
        streak: 0,
        feedback: 'Incorrect. This content was AI-generated.',
      });
    });

    it('should generate correct feedback for human-written content', async () => {
      const gameId = 'game-123';
      const submitDto: SubmitAnswerDto = {
        challengeId: 'challenge-2',
        answer: true, // Wrong - it's actually human-written
        timeSpent: 15,
      };

      const gameSession: GameSession = {
        gameId,
        userId: 'user-123',
        mode: 'quick-play',
        currentChallengeIndex: 0,
        challenges: [
          {
            id: 'challenge-2',
            type: 'text',
            content: 'Human written content',
            isAiGenerated: false,
            difficulty: 0.6,
          },
        ],
        responses: [],
        score: 50,
        streak: 1,
        startTime: Date.now() - 15000,
      };

      const scoreCalculation = {
        baseScore: 0,
        timeBonus: 0,
        streakBonus: 0,
        difficultyMultiplier: 1.0,
        totalScore: 0,
        xpGained: 0,
      };

      mockCacheService.get.mockResolvedValue(gameSession);
      mockChallengeService.validateAnswer.mockResolvedValue(false);
      mockScoreService.calculateScore.mockReturnValue(scoreCalculation);

      const result = await gameService.submitAnswer(gameId, submitDto);

      expect(result.feedback).toBe('Incorrect. This content was human-written.');
    });

    it('should throw error if game not found', async () => {
      const gameId = 'nonexistent-game';
      const submitDto: SubmitAnswerDto = {
        challengeId: 'challenge-1',
        answer: true,
        timeSpent: 10,
      };

      mockCacheService.get.mockResolvedValue(null);

      await expect(gameService.submitAnswer(gameId, submitDto)).rejects.toThrow(
        'Game not found or expired'
      );
    });

    it('should throw error if challenge not found in game', async () => {
      const gameId = 'game-123';
      const submitDto: SubmitAnswerDto = {
        challengeId: 'wrong-challenge',
        answer: true,
        timeSpent: 10,
      };

      const gameSession: GameSession = {
        gameId,
        userId: 'user-123',
        mode: 'quick-play',
        currentChallengeIndex: 0,
        challenges: [
          {
            id: 'challenge-1',
            type: 'text',
            content: 'Test content',
            isAiGenerated: true,
            difficulty: 0.5,
          },
        ],
        responses: [],
        score: 0,
        streak: 0,
        startTime: Date.now(),
      };

      mockCacheService.get.mockResolvedValue(gameSession);

      await expect(gameService.submitAnswer(gameId, submitDto)).rejects.toThrow(
        'Challenge not found in this game'
      );
    });
  });

  describe('completeGame', () => {
    it('should complete game and return results', async () => {
      const gameId = 'game-123';
      
      const gameSession: GameSession = {
        gameId,
        userId: 'user-123',
        mode: 'quick-play',
        currentChallengeIndex: 2,
        challenges: [
          {
            id: 'challenge-1',
            type: 'text',
            content: 'Test 1',
            isAiGenerated: true,
            difficulty: 0.5,
          },
          {
            id: 'challenge-2',
            type: 'text',
            content: 'Test 2',
            isAiGenerated: false,
            difficulty: 0.6,
          },
        ],
        responses: [
          {
            challengeId: 'challenge-1',
            userAnswer: true,
            isCorrect: true,
            timeSpent: 10,
            scoreEarned: 150,
          },
          {
            challengeId: 'challenge-2',
            userAnswer: true,
            isCorrect: false,
            timeSpent: 15,
            scoreEarned: 0,
          },
        ],
        score: 150,
        streak: 0,
        startTime: Date.now() - 60000,
      };

      const game = {
        id: gameId,
        userId: 'user-123',
        mode: 'quick-play' as const,
        status: 'active' as const,
        score: 0,
        startedAt: new Date(gameSession.startTime),
      };

      mockCacheService.get.mockResolvedValue(gameSession);
      mockGameRepository.findById.mockResolvedValue(game);
      mockGameRepository.update.mockResolvedValue({
        ...game,
        status: 'completed',
        score: 150,
        accuracy: 0.5,
        completedAt: new Date(),
        durationSeconds: 60,
      });

      const result = await gameService.completeGame(gameId);

      expect(mockGameRepository.update).toHaveBeenCalledWith(gameId, {
        status: 'completed',
        score: 150,
        accuracy: 0.5,
        completedAt: expect.any(Date),
        durationSeconds: expect.any(Number),
      });
      expect(mockScoreService.updateLeaderboard).toHaveBeenCalledWith(
        'user-123',
        150,
        'quick-play'
      );
      expect(mockCacheService.delete).toHaveBeenCalledWith(`game:${gameId}`);
      expect(result).toEqual({
        gameId,
        totalScore: 150,
        accuracy: 0.5,
        totalChallenges: 2,
        correctAnswers: 1,
        averageTimePerChallenge: 12.5,
        longestStreak: expect.any(Number),
      });
    });

    it('should handle game with no challenges', async () => {
      const gameId = 'game-123';
      
      const gameSession: GameSession = {
        gameId,
        userId: 'user-123',
        mode: 'quick-play',
        currentChallengeIndex: 0,
        challenges: [],
        responses: [],
        score: 0,
        streak: 0,
        startTime: Date.now() - 30000,
      };

      const game = {
        id: gameId,
        userId: 'user-123',
        mode: 'quick-play' as const,
        status: 'active' as const,
        score: 0,
        startedAt: new Date(gameSession.startTime),
      };

      mockCacheService.get.mockResolvedValue(gameSession);
      mockGameRepository.findById.mockResolvedValue(game);
      mockGameRepository.update.mockResolvedValue({
        ...game,
        status: 'completed',
        score: 0,
        accuracy: 0,
        completedAt: new Date(),
        durationSeconds: 30,
      });

      const result = await gameService.completeGame(gameId);

      expect(result.accuracy).toBe(0);
      expect(result.averageTimePerChallenge).toBe(0);
    });

    it('should throw error if game already completed', async () => {
      const gameId = 'game-123';
      
      const game = {
        id: gameId,
        userId: 'user-123',
        mode: 'quick-play' as const,
        status: 'completed' as const,
        score: 150,
        startedAt: new Date(),
        completedAt: new Date(),
      };

      mockGameRepository.findById.mockResolvedValue(game);

      await expect(gameService.completeGame(gameId)).rejects.toThrow(
        'Game already completed'
      );
    });

    it('should throw error if game not found', async () => {
      const gameId = 'nonexistent-game';

      mockGameRepository.findById.mockResolvedValue(null);

      await expect(gameService.completeGame(gameId)).rejects.toThrow(
        'Game not found'
      );
    });

    it('should throw error if game session not found', async () => {
      const gameId = 'game-123';
      
      const game = {
        id: gameId,
        userId: 'user-123',
        mode: 'quick-play' as const,
        status: 'active' as const,
        score: 0,
        startedAt: new Date(),
      };

      mockGameRepository.findById.mockResolvedValue(game);
      mockCacheService.get.mockResolvedValue(null);

      await expect(gameService.completeGame(gameId)).rejects.toThrow(
        'Game session not found'
      );
    });
  });

  describe('getGameState', () => {
    it('should return current game state', async () => {
      const gameId = 'game-123';
      
      const gameSession: GameSession = {
        gameId,
        userId: 'user-123',
        mode: 'quick-play',
        currentChallengeIndex: 1,
        challenges: [
          {
            id: 'challenge-1',
            type: 'text',
            content: 'Test 1',
            isAiGenerated: true,
            difficulty: 0.5,
          },
          {
            id: 'challenge-2',
            type: 'text',
            content: 'Test 2',
            isAiGenerated: false,
            difficulty: 0.6,
          },
        ],
        responses: [
          {
            challengeId: 'challenge-1',
            userAnswer: true,
            isCorrect: true,
            timeSpent: 10,
            scoreEarned: 150,
          },
        ],
        score: 150,
        streak: 1,
        startTime: Date.now() - 30000,
      };

      mockCacheService.get.mockResolvedValue(gameSession);

      const result = await gameService.getGameState(gameId);

      expect(result).toEqual({
        gameId,
        currentChallenge: {
          id: 'challenge-2',
          type: 'text',
          content: 'Test 2',
        },
        currentChallengeIndex: 1,
        totalChallenges: 2,
        score: 150,
        streak: 1,
        timeElapsed: expect.any(Number),
      });
    });

    it('should return null if game not found', async () => {
      const gameId = 'nonexistent-game';

      mockCacheService.get.mockResolvedValue(null);

      const result = await gameService.getGameState(gameId);

      expect(result).toBeNull();
    });

    it('should handle completed game with no current challenge', async () => {
      const gameId = 'game-123';
      
      const gameSession: GameSession = {
        gameId,
        userId: 'user-123',
        mode: 'quick-play',
        currentChallengeIndex: 2, // Past the last challenge
        challenges: [
          {
            id: 'challenge-1',
            type: 'text',
            content: 'Test 1',
            isAiGenerated: true,
            difficulty: 0.5,
          },
          {
            id: 'challenge-2',
            type: 'text',
            content: 'Test 2',
            isAiGenerated: false,
            difficulty: 0.6,
          },
        ],
        responses: [],
        score: 200,
        streak: 2,
        startTime: Date.now() - 120000,
      };

      mockCacheService.get.mockResolvedValue(gameSession);

      const result = await gameService.getGameState(gameId);

      expect(result).toEqual({
        gameId,
        currentChallenge: null,
        currentChallengeIndex: 2,
        totalChallenges: 2,
        score: 200,
        streak: 2,
        timeElapsed: expect.any(Number),
      });
    });
  });
});