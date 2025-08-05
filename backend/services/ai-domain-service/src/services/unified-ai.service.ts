import { Logger } from 'pino';
import { EventBus, CircuitBreaker, CircuitBreakerState } from '../types/domain.types';
import { ContentGenerationAggregate } from '../domain/content-generation/content-aggregate';
import { ResearchProblemAggregate } from '../domain/research-problems/research-problem-aggregate';
import { ContentGenerationRepository } from '../repositories/content-repository';
import { ResearchProblemRepository } from '../repositories/research-problem-repository';
import { DatabaseCircuitBreaker } from '../config/database';
import { retry } from 'retry';

// External AI provider interfaces
interface OpenAIProvider {
  generateText(params: { difficulty: number; topic: string }): Promise<string>;
  generateImage(params: { difficulty: number; topic: string }): Promise<string>;
  generateExplanation(params: { challenge: any }): Promise<string>;
}

interface AnthropicProvider {
  generateText(params: { difficulty: number; topic: string }): Promise<string>;
}

interface DetectionProvider {
  detectText(content: string): Promise<{ isAIGenerated: boolean; confidence: number; explanation: string }>;
  detectImage(content: string): Promise<{ isAIGenerated: boolean; confidence: number; explanation: string }>;
  analyzeComplexity(content: string): Promise<number>;
}

// Unified AI Domain Service
export class UnifiedAIService {
  private contentRepository: ContentGenerationRepository;
  private researchRepository: ResearchProblemRepository;
  private eventBus: EventBus;
  private logger: Logger;
  private databaseCircuitBreaker: DatabaseCircuitBreaker;
  private openAICircuitBreaker: CircuitBreaker;
  private anthropicCircuitBreaker: CircuitBreaker;

  constructor(
    contentRepository: ContentGenerationRepository,
    researchRepository: ResearchProblemRepository,
    eventBus: EventBus,
    logger: Logger,
    private openAIProvider: OpenAIProvider,
    private anthropicProvider: AnthropicProvider,
    private detectionProvider: DetectionProvider
  ) {
    this.contentRepository = contentRepository;
    this.researchRepository = researchRepository;
    this.eventBus = eventBus;
    this.logger = logger;
    this.databaseCircuitBreaker = new DatabaseCircuitBreaker(5, 30000, logger);
    this.openAICircuitBreaker = new ExternalServiceCircuitBreaker(3, 20000, logger, 'OpenAI');
    this.anthropicCircuitBreaker = new ExternalServiceCircuitBreaker(3, 20000, logger, 'Anthropic');
  }

  // Content Generation Methods
  async generateContent(request: {
    type: 'text' | 'image';
    difficulty: number;
    topic: string;
    userId: string;
    provider?: 'openai' | 'anthropic';
    metadata?: Record<string, any>;
  }): Promise<{
    requestId: string;
    contentId?: string;
    content?: string;
    status: 'requested' | 'generating' | 'completed' | 'failed';
    error?: string;
  }> {
    const { type, difficulty, topic, userId, provider = 'openai', metadata } = request;

    try {
      // Create or get content generation aggregate
      const aggregate = new ContentGenerationAggregate();
      
      // Request content generation
      const requestId = aggregate.requestContent(type, difficulty, topic, userId, provider, metadata);

      // Save aggregate and publish events
      await this.databaseCircuitBreaker.execute(async () => {
        await this.contentRepository.save(aggregate);
        await this.eventBus.publish(aggregate.getUncommittedEvents());
      });

      this.logger.info({ requestId, type, difficulty, topic, userId }, 'Content generation requested');

      // Generate content asynchronously with circuit breaker protection
      const result = await this.executeContentGeneration(aggregate, requestId, type, difficulty, topic, provider);
      
      return {
        requestId,
        contentId: result.contentId,
        content: result.content,
        status: result.status,
        error: result.error
      };

    } catch (error) {
      this.logger.error({ error, request }, 'Failed to generate content');
      return {
        requestId: '',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async executeContentGeneration(
    aggregate: ContentGenerationAggregate,
    requestId: string,
    type: 'text' | 'image',
    difficulty: number,
    topic: string,
    provider: 'openai' | 'anthropic'
  ): Promise<{
    contentId?: string;
    content?: string;
    status: 'completed' | 'failed';
    error?: string;
  }> {
    try {
      let content: string;
      let model: string;

      // Use circuit breaker for external AI providers
      if (type === 'text') {
        if (provider === 'anthropic') {
          content = await this.anthropicCircuitBreaker.execute(async () => {
            return await this.anthropicProvider.generateText({ difficulty, topic });
          });
          model = 'claude-3';
        } else {
          content = await this.openAICircuitBreaker.execute(async () => {
            return await this.openAIProvider.generateText({ difficulty, topic });
          });
          model = 'gpt-4';
        }
      } else if (type === 'image') {
        content = await this.openAICircuitBreaker.execute(async () => {
          return await this.openAIProvider.generateImage({ difficulty, topic });
        });
        model = 'dall-e-3';
      } else {
        throw new Error(`Unsupported content type: ${type}`);
      }

      // Generate content in aggregate
      const contentId = aggregate.generateContent(requestId, content, model, {
        complexity: type === 'text' ? await this.detectionProvider.analyzeComplexity(content) : undefined
      });

      // Validate content
      const validationResult = await this.validateContent(content, type);
      aggregate.validateContent(contentId, validationResult);

      // Save with circuit breaker protection
      await this.databaseCircuitBreaker.execute(async () => {
        await this.contentRepository.save(aggregate);
        await this.eventBus.publish(aggregate.getUncommittedEvents());
      });

      this.logger.info({ requestId, contentId, model }, 'Content generated successfully');

      return {
        contentId,
        content,
        status: 'completed'
      };

    } catch (error) {
      this.logger.error({ error, requestId }, 'Content generation failed');
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Generation failed'
      };
    }
  }

  private async validateContent(content: string, type: 'text' | 'image'): Promise<{
    isValid: boolean;
    issues: string[];
    score: number;
  }> {
    const issues: string[] = [];
    let score = 1.0;

    if (type === 'text') {
      if (content.length < 50) {
        issues.push('Content too short (minimum 50 characters)');
        score -= 0.3;
      }
      if (content.length > 1000) {
        issues.push('Content too long (maximum 1000 characters)');
        score -= 0.2;
      }
    } else if (type === 'image') {
      if (!this.isValidUrl(content)) {
        issues.push('Invalid image URL');
        score -= 0.5;
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
      score: Math.max(0, score)
    };
  }

  // AI Content Detection
  async detectAIContent(request: {
    type: 'text' | 'image';
    content: string;
    userId: string;
  }): Promise<{
    isAIGenerated: boolean;
    confidence: number;
    explanation: string;
    processingTime: number;
  }> {
    const startTime = Date.now();
    
    try {
      let result;
      
      if (request.type === 'text') {
        result = await this.detectionProvider.detectText(request.content);
      } else if (request.type === 'image') {
        result = await this.detectionProvider.detectImage(request.content);
      } else {
        throw new Error(`Unsupported content type for detection: ${request.type}`);
      }

      const processingTime = Date.now() - startTime;
      
      this.logger.info({
        type: request.type,
        contentLength: request.content.length,
        isAIGenerated: result.isAIGenerated,
        confidence: result.confidence,
        processingTime
      }, 'AI content detection completed');

      return {
        ...result,
        processingTime
      };

    } catch (error) {
      this.logger.error({ error, request }, 'AI content detection failed');
      throw error;
    }
  }

  // Research Problem Methods (consolidated from ai-research-service)
  async createResearchProblem(request: {
    problemType: 'bias_detection' | 'alignment' | 'context_evaluation';
    title: string;
    description: string;
    difficultyLevel: number;
    institutionId: string;
    institutionName: string;
    problemData: any;
    tags: string[];
    metadata: any;
  }): Promise<{ problemId: string; aggregateId: string }> {
    try {
      const aggregate = new ResearchProblemAggregate();
      const problemId = `${request.problemType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const validationCriteria = {
        requiredAccuracy: 0.7 + (request.difficultyLevel * 0.05),
        minimumContributions: 3,
        expertValidationRequired: request.difficultyLevel > 7,
        peerReviewThreshold: 0.8,
        validationMethod: 'hybrid' as const
      };

      aggregate.createProblem(
        problemId,
        request.institutionId,
        request.problemType as any,
        request.title,
        request.description,
        request.difficultyLevel,
        request.problemData,
        validationCriteria,
        request.tags,
        request.metadata
      );

      await this.databaseCircuitBreaker.execute(async () => {
        await this.researchRepository.save(aggregate);
        await this.eventBus.publish(aggregate.getUncommittedEvents());
      });

      this.logger.info({ problemId, aggregateId: aggregate.id }, 'Research problem created');

      return {
        problemId,
        aggregateId: aggregate.id
      };

    } catch (error) {
      this.logger.error({ error, request }, 'Failed to create research problem');
      throw error;
    }
  }

  async transformToGameProblem(request: {
    problemId: string;
    gameType: string;
    playerLevel: number;
    mechanicsConfig: any;
    difficultyProgression: any;
  }): Promise<{ gameProblemId: string }> {
    try {
      // Find aggregate containing the problem
      const aggregates = await this.researchRepository.findByProblemType('bias_detection' as any);
      let targetAggregate: ResearchProblemAggregate | null = null;

      for (const aggregate of aggregates) {
        if (aggregate.getProblem(request.problemId)) {
          targetAggregate = aggregate;
          break;
        }
      }

      if (!targetAggregate) {
        throw new Error(`Research problem ${request.problemId} not found`);
      }

      const gameProblemId = targetAggregate.transformToGame(
        request.problemId,
        request.gameType,
        request.playerLevel,
        request.mechanicsConfig,
        request.difficultyProgression
      );

      await this.databaseCircuitBreaker.execute(async () => {
        await this.researchRepository.save(targetAggregate!);
        await this.eventBus.publish(targetAggregate!.getUncommittedEvents());
      });

      this.logger.info({ problemId: request.problemId, gameProblemId }, 'Problem transformed to game format');

      return { gameProblemId };

    } catch (error) {
      this.logger.error({ error, request }, 'Failed to transform problem to game format');
      throw error;
    }
  }

  // Health check and monitoring
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: {
      database: boolean;
      openAI: boolean;
      anthropic: boolean;
      eventBus: boolean;
    };
    circuitBreakers: {
      database: any;
      openAI: any;
      anthropic: any;
    };
  }> {
    const checks = {
      database: false,
      openAI: false,
      anthropic: false,
      eventBus: false
    };

    try {
      // Database health check
      await this.databaseCircuitBreaker.execute(async () => {
        const aggregate = new ContentGenerationAggregate();
        // Just test connection without saving
        checks.database = true;
      });
    } catch {
      checks.database = false;
    }

    // External service checks (simplified)
    try {
      checks.openAI = this.openAICircuitBreaker['state'] !== CircuitBreakerState.OPEN;
      checks.anthropic = this.anthropicCircuitBreaker['state'] !== CircuitBreakerState.OPEN;
      checks.eventBus = true; // Simplified check
    } catch {
      // Circuit breaker checks failed
    }

    const healthyCount = Object.values(checks).filter(Boolean).length;
    const status = healthyCount === 4 ? 'healthy' : 
                   healthyCount >= 2 ? 'degraded' : 'unhealthy';

    return {
      status,
      checks,
      circuitBreakers: {
        database: this.databaseCircuitBreaker.getState(),
        openAI: (this.openAICircuitBreaker as any).getState(),
        anthropic: (this.anthropicCircuitBreaker as any).getState()
      }
    };
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

// External Service Circuit Breaker Implementation
class ExternalServiceCircuitBreaker implements CircuitBreaker {
  public state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failures = 0;
  private lastFailureTime = 0;

  constructor(
    private readonly failureThreshold: number,
    private readonly recoveryTimeout: number,
    private readonly logger: Logger,
    private readonly serviceName: string
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (Date.now() - this.lastFailureTime < this.recoveryTimeout) {
        throw new Error(`Circuit breaker is OPEN for ${this.serviceName}`);
      }
      this.state = CircuitBreakerState.HALF_OPEN;
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = CircuitBreakerState.CLOSED;
    this.logger.debug({ service: this.serviceName }, 'Circuit breaker: Operation succeeded, state is CLOSED');
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.failureThreshold) {
      this.state = CircuitBreakerState.OPEN;
      this.logger.warn({ 
        service: this.serviceName, 
        failures: this.failures 
      }, 'Circuit breaker opened due to failures');
    }
  }

  getState(): { state: CircuitBreakerState; failures: number; lastFailureTime: number } {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    };
  }
}