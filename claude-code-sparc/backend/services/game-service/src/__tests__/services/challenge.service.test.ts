import { ChallengeService } from '../../services/challenge.service';
import type { IChallengeRepository } from '../../repositories/interfaces/challenge.repository.interface';
import type { GameMode } from '../../types/game.types';

describe('ChallengeService', () => {
  let challengeService: ChallengeService;
  let mockChallengeRepository: jest.Mocked<IChallengeRepository>;

  beforeEach(() => {
    mockChallengeRepository = {
      findByDifficulty: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      findRandom: jest.fn(),
    };

    challengeService = new ChallengeService(mockChallengeRepository);
  });

  describe('generateChallenges', () => {
    it('should generate challenges for quick-play mode', async () => {
      const mode: GameMode = 'quick-play';
      const userId = 'user-123';

      const mockChallenges = [
        {
          id: 'challenge-1',
          type: 'text' as const,
          content: 'AI generated text example',
          isAiGenerated: true,
          difficulty: 0.5,
        },
        {
          id: 'challenge-2',
          type: 'text' as const,
          content: 'Human written text',
          isAiGenerated: false,
          difficulty: 0.5,
        },
        {
          id: 'challenge-3',
          type: 'image' as const,
          content: 'image-url-1',
          isAiGenerated: true,
          difficulty: 0.6,
        },
        {
          id: 'challenge-4',
          type: 'image' as const,
          content: 'image-url-2',
          isAiGenerated: false,
          difficulty: 0.6,
        },
        {
          id: 'challenge-5',
          type: 'text' as const,
          content: 'Another AI text',
          isAiGenerated: true,
          difficulty: 0.7,
        },
      ];

      mockChallengeRepository.findRandom.mockResolvedValue(mockChallenges);

      const result = await challengeService.generateChallenges(mode, userId);

      expect(mockChallengeRepository.findRandom).toHaveBeenCalledWith(5, {
        minDifficulty: 0.3,
        maxDifficulty: 0.7,
      });
      expect(result).toHaveLength(5);
      expect(result).toEqual(mockChallenges);
    });

    it('should generate harder challenges for tournament mode', async () => {
      const mode: GameMode = 'tournament';
      const userId = 'user-123';

      const mockChallenges = Array(10).fill(null).map((_, i) => ({
        id: `challenge-${i}`,
        type: i % 2 === 0 ? 'text' as const : 'image' as const,
        content: `content-${i}`,
        isAiGenerated: i % 2 === 0,
        difficulty: 0.7 + (i * 0.02),
      }));

      mockChallengeRepository.findRandom.mockResolvedValue(mockChallenges);

      const result = await challengeService.generateChallenges(mode, userId);

      expect(mockChallengeRepository.findRandom).toHaveBeenCalledWith(10, {
        minDifficulty: 0.6,
        maxDifficulty: 0.9,
      });
      expect(result).toHaveLength(10);
    });

    it('should generate challenges for daily-challenge mode', async () => {
      const mode: GameMode = 'daily-challenge';
      const userId = 'user-123';

      const mockChallenges = Array(7).fill(null).map((_, i) => ({
        id: `challenge-${i}`,
        type: 'text' as const,
        content: `daily-content-${i}`,
        isAiGenerated: i % 3 === 0,
        difficulty: 0.5 + (i * 0.05),
      }));

      mockChallengeRepository.findRandom.mockResolvedValue(mockChallenges);

      const result = await challengeService.generateChallenges(mode, userId);

      expect(mockChallengeRepository.findRandom).toHaveBeenCalledWith(7, {
        minDifficulty: 0.4,
        maxDifficulty: 0.8,
      });
      expect(result).toHaveLength(7);
    });

    it('should generate challenges for research mode', async () => {
      const mode: GameMode = 'research-mode';
      const userId = 'user-123';

      const mockChallenges = Array(20).fill(null).map((_, i) => ({
        id: `challenge-${i}`,
        type: i < 10 ? 'text' as const : 'image' as const,
        content: `research-content-${i}`,
        isAiGenerated: i % 2 === 1,
        difficulty: 0.3 + (i * 0.03),
      }));

      mockChallengeRepository.findRandom.mockResolvedValue(mockChallenges);

      const result = await challengeService.generateChallenges(mode, userId);

      expect(mockChallengeRepository.findRandom).toHaveBeenCalledWith(20, {
        minDifficulty: 0.3,
        maxDifficulty: 0.9,
      });
      expect(result).toHaveLength(20);
    });
  });

  describe('validateAnswer', () => {
    it('should return true for correct answer', async () => {
      const challengeId = 'challenge-1';
      const answer = true;

      const challenge = {
        id: challengeId,
        type: 'text' as const,
        content: 'AI generated content',
        isAiGenerated: true,
        difficulty: 0.5,
      };

      mockChallengeRepository.findById.mockResolvedValue(challenge);

      const result = await challengeService.validateAnswer(challengeId, answer);

      expect(mockChallengeRepository.findById).toHaveBeenCalledWith(challengeId);
      expect(result).toBe(true);
    });

    it('should return false for incorrect answer', async () => {
      const challengeId = 'challenge-2';
      const answer = true;

      const challenge = {
        id: challengeId,
        type: 'text' as const,
        content: 'Human written content',
        isAiGenerated: false,
        difficulty: 0.5,
      };

      mockChallengeRepository.findById.mockResolvedValue(challenge);

      const result = await challengeService.validateAnswer(challengeId, answer);

      expect(result).toBe(false);
    });

    it('should throw error if challenge not found', async () => {
      const challengeId = 'nonexistent';
      const answer = true;

      mockChallengeRepository.findById.mockResolvedValue(null);

      await expect(
        challengeService.validateAnswer(challengeId, answer)
      ).rejects.toThrow('Challenge not found');
    });
  });
});