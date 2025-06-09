import { AIService } from '../../services/ai.service';
import { OpenAIService } from '../../services/openai.service';
import { AnthropicService } from '../../services/anthropic.service';
import { DetectionService } from '../../services/detection.service';
import { ChallengeType } from '../../types/ai.types';

jest.mock('../../services/openai.service');
jest.mock('../../services/anthropic.service');
jest.mock('../../services/detection.service');

describe('AIService', () => {
  let aiService: AIService;
  let mockOpenAIService: jest.Mocked<OpenAIService>;
  let mockAnthropicService: jest.Mocked<AnthropicService>;
  let mockDetectionService: jest.Mocked<DetectionService>;

  beforeEach(() => {
    mockOpenAIService = new OpenAIService() as jest.Mocked<OpenAIService>;
    mockAnthropicService = new AnthropicService() as jest.Mocked<AnthropicService>;
    mockDetectionService = new DetectionService() as jest.Mocked<DetectionService>;
    
    aiService = new AIService(
      mockOpenAIService,
      mockAnthropicService,
      mockDetectionService
    );
  });

  describe('generateContent', () => {
    it('should generate text content using OpenAI', async () => {
      const mockContent = 'This is AI generated text';
      mockOpenAIService.generateText.mockResolvedValue(mockContent);

      const result = await aiService.generateContent({
        type: 'text',
        difficulty: 'medium',
        topic: 'technology',
      });

      expect(result).toEqual({
        type: 'text',
        content: mockContent,
        metadata: {
          model: 'gpt-4',
          difficulty: 'medium',
          topic: 'technology',
        },
      });
      expect(mockOpenAIService.generateText).toHaveBeenCalledWith({
        difficulty: 'medium',
        topic: 'technology',
      });
    });

    it('should generate text content using Anthropic', async () => {
      const mockContent = 'This is Claude generated text';
      mockAnthropicService.generateText.mockResolvedValue(mockContent);

      const result = await aiService.generateContent({
        type: 'text',
        difficulty: 'hard',
        topic: 'science',
        provider: 'anthropic',
      });

      expect(result).toEqual({
        type: 'text',
        content: mockContent,
        metadata: {
          model: 'claude-3',
          difficulty: 'hard',
          topic: 'science',
        },
      });
      expect(mockAnthropicService.generateText).toHaveBeenCalledWith({
        difficulty: 'hard',
        topic: 'science',
      });
    });

    it('should generate image content', async () => {
      const mockImageUrl = 'https://example.com/ai-generated-image.jpg';
      mockOpenAIService.generateImage.mockResolvedValue(mockImageUrl);

      const result = await aiService.generateContent({
        type: 'image',
        difficulty: 'easy',
        topic: 'nature',
      });

      expect(result).toEqual({
        type: 'image',
        content: mockImageUrl,
        metadata: {
          model: 'dall-e-3',
          difficulty: 'easy',
          topic: 'nature',
        },
      });
      expect(mockOpenAIService.generateImage).toHaveBeenCalledWith({
        difficulty: 'easy',
        topic: 'nature',
      });
    });

    it('should throw error for unsupported content type', async () => {
      await expect(
        aiService.generateContent({
          type: 'video' as ChallengeType,
          difficulty: 'medium',
          topic: 'general',
        })
      ).rejects.toThrow('Unsupported content type: video');
    });
  });

  describe('detectAIContent', () => {
    it('should detect AI-generated text', async () => {
      const testContent = 'This might be AI generated';
      mockDetectionService.detectText.mockResolvedValue({
        isAI: true,
        confidence: 0.89,
        indicators: ['uniform sentence structure', 'lack of personal anecdotes'],
      });

      const result = await aiService.detectAIContent({
        type: 'text',
        content: testContent,
      });

      expect(result).toEqual({
        isAI: true,
        confidence: 0.89,
        indicators: ['uniform sentence structure', 'lack of personal anecdotes'],
      });
      expect(mockDetectionService.detectText).toHaveBeenCalledWith(testContent);
    });

    it('should detect AI-generated images', async () => {
      const testImageUrl = 'https://example.com/test-image.jpg';
      mockDetectionService.detectImage.mockResolvedValue({
        isAI: false,
        confidence: 0.92,
        indicators: ['natural lighting variations', 'authentic metadata'],
      });

      const result = await aiService.detectAIContent({
        type: 'image',
        content: testImageUrl,
      });

      expect(result).toEqual({
        isAI: false,
        confidence: 0.92,
        indicators: ['natural lighting variations', 'authentic metadata'],
      });
      expect(mockDetectionService.detectImage).toHaveBeenCalledWith(testImageUrl);
    });
  });

  describe('generateExplanation', () => {
    it('should generate explanation for why content is AI-generated', async () => {
      const mockExplanation = 'This text shows typical AI patterns...';
      mockOpenAIService.generateExplanation.mockResolvedValue(mockExplanation);

      const result = await aiService.generateExplanation({
        content: 'Test content',
        isAI: true,
        indicators: ['pattern1', 'pattern2'],
      });

      expect(result).toBe(mockExplanation);
      expect(mockOpenAIService.generateExplanation).toHaveBeenCalledWith({
        content: 'Test content',
        isAI: true,
        indicators: ['pattern1', 'pattern2'],
      });
    });
  });

  describe('validateChallenge', () => {
    it('should validate text challenge meets requirements', async () => {
      const challenge = {
        type: 'text' as ChallengeType,
        content: 'This is a valid challenge text with sufficient length and complexity.',
        metadata: {
          model: 'gpt-4',
          difficulty: 'medium' as const,
          topic: 'technology',
        },
      };

      const result = await aiService.validateChallenge(challenge);

      expect(result).toEqual({
        isValid: true,
        issues: [],
      });
    });

    it('should reject text challenge that is too short', async () => {
      const challenge = {
        type: 'text' as ChallengeType,
        content: 'Too short',
        metadata: {
          model: 'gpt-4',
          difficulty: 'medium' as const,
          topic: 'technology',
        },
      };

      const result = await aiService.validateChallenge(challenge);

      expect(result).toEqual({
        isValid: false,
        issues: ['Content too short (minimum 50 characters)'],
      });
    });

    it('should validate image challenge has valid URL', async () => {
      const challenge = {
        type: 'image' as ChallengeType,
        content: 'https://example.com/valid-image.jpg',
        metadata: {
          model: 'dall-e-3',
          difficulty: 'hard' as const,
          topic: 'art',
        },
      };

      const result = await aiService.validateChallenge(challenge);

      expect(result).toEqual({
        isValid: true,
        issues: [],
      });
    });
  });

  describe('enrichChallenge', () => {
    it('should enrich challenge with additional metadata', async () => {
      const challenge = {
        type: 'text' as ChallengeType,
        content: 'Original content',
        metadata: {
          model: 'gpt-4',
          difficulty: 'medium' as const,
          topic: 'science',
        },
      };

      mockDetectionService.analyzeComplexity.mockResolvedValue({
        readabilityScore: 65,
        vocabularyLevel: 'intermediate',
        sentenceComplexity: 'moderate',
      });

      const enriched = await aiService.enrichChallenge(challenge);

      expect(enriched.metadata).toMatchObject({
        model: 'gpt-4',
        difficulty: 'medium',
        topic: 'science',
        complexity: {
          readabilityScore: 65,
          vocabularyLevel: 'intermediate',
          sentenceComplexity: 'moderate',
        },
        timestamp: expect.any(String),
      });
    });
  });
});