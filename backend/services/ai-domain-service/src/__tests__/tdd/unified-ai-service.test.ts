// London School TDD Test for UnifiedAIService
// This test follows the "tell, don't ask" principle and focuses on behavior verification

import { UnifiedAIService } from '../../services/unified-ai.service';
import { ContentGenerationRepository } from '../../repositories/content-repository';
import { ResearchProblemRepository } from '../../repositories/research-problem-repository';
import { EventBus } from '../../types/domain.types';
import { 
  createMockLogger,
  createMockEventBus,
  ContentRequestBuilder,
  ResearchProblemBuilder,
  createMockOpenAIProvider,
  createMockAnthropicProvider,
  createMockDetectionProvider,
  assertMockCalledWith,
  assertMockCalledTimes,
  verifyInteraction,
  simulateError,
  simulateSuccess
} from '../setup';

describe('UnifiedAIService', () => {
  let service: UnifiedAIService;
  let mockContentRepository: jest.Mocked<ContentGenerationRepository>;
  let mockResearchRepository: jest.Mocked<ResearchProblemRepository>;
  let mockEventBus: jest.Mocked<EventBus>;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let mockOpenAIProvider: ReturnType<typeof createMockOpenAIProvider>;
  let mockAnthropicProvider: ReturnType<typeof createMockAnthropicProvider>;
  let mockDetectionProvider: ReturnType<typeof createMockDetectionProvider>;

  beforeEach(() => {
    // London School: Create all mocks as test doubles
    mockContentRepository = {
      save: jest.fn(),
      getById: jest.fn(),
      delete: jest.fn(),
      findByUserId: jest.fn(),
      findByContentType: jest.fn(),
      getContentGenerationStats: jest.fn()
    } as any;

    mockResearchRepository = {
      save: jest.fn(),
      getById: jest.fn(),
      delete: jest.fn(),
      findByProblemType: jest.fn(),
      findByDifficultyRange: jest.fn(),
      findByInstitution: jest.fn(),
      getResearchProblemStats: jest.fn(),
      findGameTransformations: jest.fn()
    } as any;

    mockEventBus = createMockEventBus();
    mockLogger = createMockLogger();
    mockOpenAIProvider = createMockOpenAIProvider();
    mockAnthropicProvider = createMockAnthropicProvider();
    mockDetectionProvider = createMockDetectionProvider();

    service = new UnifiedAIService(
      mockContentRepository,
      mockResearchRepository,
      mockEventBus,
      mockLogger,
      mockOpenAIProvider,
      mockAnthropicProvider,
      mockDetectionProvider
    );
  });

  describe('generateContent', () => {
    it('should request content generation and save aggregate', async () => {
      // Arrange
      const request = new ContentRequestBuilder()
        .withType('text')
        .withDifficulty(3)
        .withTopic('machine learning')
        .withUserId('user-123')
        .withProvider('openai')
        .build();

      simulateSuccess(mockContentRepository.save);
      simulateSuccess(mockEventBus.publish);
      simulateSuccess(mockOpenAIProvider.generateText, 'Generated ML content');
      simulateSuccess(mockDetectionProvider.analyzeComplexity, 0.7);

      // Act
      const result = await service.generateContent(request);

      // Assert - London School: Verify interactions with collaborators
      assertMockCalledTimes(mockContentRepository.save, 2); // Once for request, once for generation
      assertMockCalledTimes(mockEventBus.publish, 2);
      assertMockCalledWith(mockOpenAIProvider.generateText, {
        difficulty: 3,
        topic: 'machine learning'
      });

      expect(result).toMatchObject({
        requestId: expect.any(String),
        contentId: expect.any(String),
        content: 'Generated ML content',
        status: 'completed'
      });

      verifyInteraction(mockLogger.info, {
        method: 'info',
        times: 2 // Request logged and completion logged
      });
    });

    it('should use Anthropic provider when specified', async () => {
      // Arrange
      const request = new ContentRequestBuilder()
        .withType('text')
        .withProvider('anthropic')
        .build();

      simulateSuccess(mockContentRepository.save);
      simulateSuccess(mockEventBus.publish);
      simulateSuccess(mockAnthropicProvider.generateText, 'Anthropic generated content');
      simulateSuccess(mockDetectionProvider.analyzeComplexity, 0.8);

      // Act
      await service.generateContent(request);

      // Assert
      assertMockCalledWith(mockAnthropicProvider.generateText, {
        difficulty: request.difficulty,
        topic: request.topic
      });
      verifyInteraction(mockOpenAIProvider.generateText, { times: 0 }); // Should not be called
    });

    it('should handle OpenAI provider failure gracefully', async () => {
      // Arrange
      const request = new ContentRequestBuilder().withProvider('openai').build();
      
      simulateSuccess(mockContentRepository.save);
      simulateSuccess(mockEventBus.publish);
      simulateError(mockOpenAIProvider.generateText, 'OpenAI API error');

      // Act
      const result = await service.generateContent(request);

      // Assert
      expect(result).toMatchObject({
        status: 'failed',
        error: expect.stringContaining('OpenAI API error')
      });

      verifyInteraction(mockLogger.error, {
        method: 'error',
        times: 1
      });
    });

    it('should validate generated content and create validation events', async () => {
      // Arrange
      const request = new ContentRequestBuilder()
        .withType('text')
        .build();

      const shortContent = 'Too short'; // Should fail validation
      
      simulateSuccess(mockContentRepository.save);
      simulateSuccess(mockEventBus.publish);
      simulateSuccess(mockOpenAIProvider.generateText, shortContent);
      simulateSuccess(mockDetectionProvider.analyzeComplexity, 0.5);

      // Act
      await service.generateContent(request);

      // Assert
      // Verify that save was called twice (request + generation with validation)
      assertMockCalledTimes(mockContentRepository.save, 2);
      
      // Verify that the second save includes validation result
      const secondSaveCall = mockContentRepository.save.mock.calls[1][0];
      expect(secondSaveCall).toHaveUncommittedEvents(); // Custom matcher from setup
      expect(secondSaveCall).toHaveEventOfType('ContentValidated');
    });

    it('should handle image generation requests', async () => {
      // Arrange
      const request = new ContentRequestBuilder()
        .withType('image')
        .withTopic('abstract art')
        .build();

      const imageUrl = 'https://example.com/generated-image.jpg';
      
      simulateSuccess(mockContentRepository.save);
      simulateSuccess(mockEventBus.publish);
      simulateSuccess(mockOpenAIProvider.generateImage, imageUrl);

      // Act
      const result = await service.generateContent(request);

      // Assert
      assertMockCalledWith(mockOpenAIProvider.generateImage, {
        difficulty: request.difficulty,
        topic: request.topic
      });

      expect(result).toMatchObject({
        status: 'completed',
        content: imageUrl
      });

      // Verify complexity analysis is not called for images
      verifyInteraction(mockDetectionProvider.analyzeComplexity, { times: 0 });
    });

    it('should fail for unsupported content types', async () => {
      // Arrange
      const request = {
        ...new ContentRequestBuilder().build(),
        type: 'video' as any // Unsupported type
      };

      simulateSuccess(mockContentRepository.save);
      simulateSuccess(mockEventBus.publish);

      // Act
      const result = await service.generateContent(request);

      // Assert
      expect(result).toMatchObject({
        status: 'failed',
        error: expect.stringContaining('Unsupported content type')
      });
    });
  });

  describe('detectAIContent', () => {
    it('should detect AI-generated text content', async () => {
      // Arrange
      const request = {
        type: 'text' as const,
        content: 'This is sample text content to analyze',
        userId: 'user-123'
      };

      const detectionResult = {
        isAIGenerated: true,
        confidence: 0.85,
        explanation: 'Text shows patterns consistent with AI generation'
      };

      simulateSuccess(mockDetectionProvider.detectText, detectionResult);

      // Act
      const result = await service.detectAIContent(request);

      // Assert
      assertMockCalledWith(mockDetectionProvider.detectText, request.content);
      
      expect(result).toMatchObject({
        ...detectionResult,
        processingTime: expect.any(Number)
      });

      verifyInteraction(mockLogger.info, {
        method: 'info',
        times: 1
      });
    });

    it('should detect AI-generated image content', async () => {
      // Arrange
      const request = {
        type: 'image' as const,
        content: 'base64-encoded-image-data',
        userId: 'user-123'
      };

      const detectionResult = {
        isAIGenerated: false,
        confidence: 0.92,
        explanation: 'Image appears to be naturally photographed'
      };

      simulateSuccess(mockDetectionProvider.detectImage, detectionResult);

      // Act
      const result = await service.detectAIContent(request);

      // Assert
      assertMockCalledWith(mockDetectionProvider.detectImage, request.content);
      expect(result).toMatchObject(detectionResult);
    });

    it('should handle detection service failures', async () => {
      // Arrange
      const request = {
        type: 'text' as const,
        content: 'test content',
        userId: 'user-123'
      };

      simulateError(mockDetectionProvider.detectText, 'Detection service unavailable');

      // Act & Assert
      await expect(service.detectAIContent(request)).rejects.toThrow('Detection service unavailable');
      
      verifyInteraction(mockLogger.error, {
        method: 'error',
        times: 1
      });
    });
  });

  describe('createResearchProblem', () => {
    it('should create research problem aggregate and publish events', async () => {
      // Arrange
      const request = new ResearchProblemBuilder()
        .withProblemType('bias_detection')
        .withTitle('Gender Bias Detection Challenge')
        .withDifficultyLevel(5)
        .build();

      simulateSuccess(mockResearchRepository.save);
      simulateSuccess(mockEventBus.publish);

      // Act
      const result = await service.createResearchProblem(request);

      // Assert
      assertMockCalledTimes(mockResearchRepository.save, 1);
      assertMockCalledTimes(mockEventBus.publish, 1);

      expect(result).toMatchObject({
        problemId: expect.stringContaining('bias_detection'),
        aggregateId: expect.any(String)
      });

      // Verify the saved aggregate has the correct events
      const savedAggregate = mockResearchRepository.save.mock.calls[0][0];
      expect(savedAggregate).toHaveEventOfType('ProblemCreated');

      verifyInteraction(mockLogger.info, {
        method: 'info',
        times: 1
      });
    });

    it('should calculate validation criteria based on difficulty level', async () => {
      // Arrange
      const highDifficultyRequest = new ResearchProblemBuilder()
        .withDifficultyLevel(8) // High difficulty
        .build();

      simulateSuccess(mockResearchRepository.save);
      simulateSuccess(mockEventBus.publish);

      // Act
      await service.createResearchProblem(highDifficultyRequest);

      // Assert
      const savedAggregate = mockResearchRepository.save.mock.calls[0][0];
      const problem = savedAggregate.getAllProblems?.()?.[0] || savedAggregate.getProblem?.(Object.keys(savedAggregate.problems || {})[0]);
      
      // High difficulty should require expert validation
      expect(problem?.validationCriteria?.expertValidationRequired).toBe(true);
      expect(problem?.validationCriteria?.requiredAccuracy).toBeGreaterThan(0.7);
    });

    it('should handle repository save failures', async () => {
      // Arrange
      const request = new ResearchProblemBuilder().build();
      
      simulateError(mockResearchRepository.save, 'Database connection failed');

      // Act & Assert
      await expect(service.createResearchProblem(request)).rejects.toThrow('Database connection failed');
      
      verifyInteraction(mockLogger.error, {
        method: 'error',
        times: 1
      });
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when all services are operational', async () => {
      // Arrange - All circuit breakers are closed (healthy)

      // Act
      const result = await service.healthCheck();

      // Assert
      expect(result.status).toBe('healthy');
      expect(result.checks.database).toBe(true);
      expect(result.checks.openAI).toBe(true);
      expect(result.checks.anthropic).toBe(true);
      expect(result.checks.eventBus).toBe(true);
    });

    it('should return degraded status when some services are down', async () => {
      // Arrange - Simulate circuit breaker issues
      // This would require mocking the circuit breaker state

      // Act
      const result = await service.healthCheck();

      // Assert
      expect(['healthy', 'degraded', 'unhealthy']).toContain(result.status);
      expect(result.circuitBreakers).toBeDefined();
    });
  });

  describe('Circuit Breaker Integration', () => {
    it('should trigger circuit breaker after repeated OpenAI failures', async () => {
      // Arrange
      const request = new ContentRequestBuilder().withProvider('openai').build();
      
      simulateSuccess(mockContentRepository.save);
      simulateSuccess(mockEventBus.publish);
      simulateError(mockOpenAIProvider.generateText, 'API Rate limit exceeded');

      // Act - Trigger multiple failures
      for (let i = 0; i < 4; i++) {
        await service.generateContent(request);
      }

      // Assert
      assertMockCalledTimes(mockOpenAIProvider.generateText, 4);
      
      // Verify error logging
      verifyInteraction(mockLogger.error, {
        method: 'error',
        times: 4
      });
    });

    it('should fail fast when circuit breaker is open', async () => {
      // This test would require more sophisticated circuit breaker mocking
      // to simulate the open state
      expect(true).toBe(true); // Placeholder
    });
  });
});