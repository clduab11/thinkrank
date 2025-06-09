import {
  ChallengeType,
  GenerateContentRequest,
  GeneratedContent,
  DetectContentRequest,
  DetectionResult,
  ExplanationRequest,
  ValidationResult,
} from '../types/ai.types';
import { OpenAIService } from './openai.service';
import { AnthropicService } from './anthropic.service';
import { DetectionService } from './detection.service';

export class AIService {
  constructor(
    private openAIService: OpenAIService,
    private anthropicService: AnthropicService,
    private detectionService: DetectionService
  ) {}

  async generateContent(request: GenerateContentRequest): Promise<GeneratedContent> {
    const { type, difficulty, topic, provider = 'openai' } = request;

    let content: string;
    let model: string;

    switch (type) {
      case 'text':
        if (provider === 'anthropic') {
          content = await this.anthropicService.generateText({ difficulty, topic });
          model = 'claude-3';
        } else {
          content = await this.openAIService.generateText({ difficulty, topic });
          model = 'gpt-4';
        }
        break;

      case 'image':
        content = await this.openAIService.generateImage({ difficulty, topic });
        model = 'dall-e-3';
        break;

      default:
        throw new Error(`Unsupported content type: ${type}`);
    }

    return {
      type,
      content,
      metadata: {
        model,
        difficulty,
        topic,
      },
    };
  }

  async detectAIContent(request: DetectContentRequest): Promise<DetectionResult> {
    const { type, content } = request;

    switch (type) {
      case 'text':
        return this.detectionService.detectText(content);
      case 'image':
        return this.detectionService.detectImage(content);
      default:
        throw new Error(`Unsupported content type for detection: ${type}`);
    }
  }

  async generateExplanation(request: ExplanationRequest): Promise<string> {
    return this.openAIService.generateExplanation(request);
  }

  async validateChallenge(challenge: GeneratedContent): Promise<ValidationResult> {
    const issues: string[] = [];

    // Validate based on content type
    switch (challenge.type) {
      case 'text':
        if (challenge.content.length < 50) {
          issues.push('Content too short (minimum 50 characters)');
        }
        if (challenge.content.length > 1000) {
          issues.push('Content too long (maximum 1000 characters)');
        }
        break;

      case 'image':
        if (!this.isValidUrl(challenge.content)) {
          issues.push('Invalid image URL');
        }
        break;
    }

    // Check metadata
    if (!challenge.metadata.model || !challenge.metadata.difficulty || !challenge.metadata.topic) {
      issues.push('Missing required metadata');
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }

  async enrichChallenge(challenge: GeneratedContent): Promise<GeneratedContent> {
    const enriched = { ...challenge };

    // Add complexity analysis for text
    if (challenge.type === 'text') {
      enriched.metadata.complexity = await this.detectionService.analyzeComplexity(challenge.content);
    }

    // Add timestamp
    enriched.metadata.timestamp = new Date().toISOString();

    return enriched;
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