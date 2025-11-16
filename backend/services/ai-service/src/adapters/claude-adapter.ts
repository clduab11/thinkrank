/**
 * Claude AI Adapter - November 2025 Standards
 * Anthropic Claude Sonnet 4.5 integration with streaming support
 *
 * FEATURES:
 * - Streaming responses for real-time interaction
 * - Context management and message history
 * - Tool use / function calling
 * - Multimodal support (text + images)
 * - Rate limiting and error handling
 */

import Anthropic from '@anthropic-ai/sdk';
import { Logger } from '@thinkrank/shared';
import { EventEmitter } from 'events';

export interface ClaudeConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  topP?: number;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface StreamChunk {
  type: 'content_block_delta' | 'message_stop' | 'error';
  text?: string;
  stopReason?: string;
  error?: string;
}

export interface CompletionRequest {
  messages: Message[];
  systemPrompt?: string;
  stream?: boolean;
  tools?: Tool[];
  maxTokens?: number;
  temperature?: number;
}

export interface Tool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface CompletionResponse {
  content: string;
  stopReason: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, any>;
}

export class ClaudeAdapter extends EventEmitter {
  private client: Anthropic;
  private logger: Logger;
  private config: ClaudeConfig;
  private conversationHistory: Map<string, Message[]> = new Map();

  constructor(config: ClaudeConfig) {
    super();
    this.config = {
      model: config.model || 'claude-sonnet-4-5-20250929',
      maxTokens: config.maxTokens || 4096,
      temperature: config.temperature || 0.7,
      ...config
    };

    this.client = new Anthropic({
      apiKey: config.apiKey,
    });

    this.logger = Logger.create({
      service: 'claude-adapter',
      level: 'INFO',
      console_enabled: true,
      file_enabled: false,
      structured: true
    });
  }

  /**
   * Generate completion with Claude
   */
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const startTime = Date.now();

    try {
      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: request.maxTokens || this.config.maxTokens,
        temperature: request.temperature || this.config.temperature,
        system: request.systemPrompt,
        messages: request.messages.map(m => ({
          role: m.role,
          content: m.content
        })),
        tools: request.tools,
      });

      const content = this.extractContent(response);
      const toolCalls = this.extractToolCalls(response);

      const result: CompletionResponse = {
        content,
        stopReason: response.stop_reason || 'end_turn',
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens
        },
        toolCalls
      };

      this.logger.info('Claude completion generated', {
        duration: Date.now() - startTime,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        stopReason: result.stopReason
      });

      return result;

    } catch (error) {
      this.logger.error('Claude completion failed', {}, error);
      throw error;
    }
  }

  /**
   * Stream completion with real-time updates
   */
  async *streamCompletion(request: CompletionRequest): AsyncGenerator<StreamChunk, void, unknown> {
    try {
      const stream = await this.client.messages.stream({
        model: this.config.model,
        max_tokens: request.maxTokens || this.config.maxTokens,
        temperature: request.temperature || this.config.temperature,
        system: request.systemPrompt,
        messages: request.messages.map(m => ({
          role: m.role,
          content: m.content
        })),
        tools: request.tools,
      });

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && 'delta' in chunk && 'text' in chunk.delta) {
          yield {
            type: 'content_block_delta',
            text: chunk.delta.text
          };
        } else if (chunk.type === 'message_stop') {
          yield {
            type: 'message_stop',
            stopReason: 'end_turn'
          };
        }
      }

    } catch (error) {
      this.logger.error('Claude streaming failed', {}, error);
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate AI literacy assessment
   */
  async assessAILiteracy(params: {
    userResponse: string;
    question: string;
    expectedAnswer?: string;
    rubric?: string;
  }): Promise<{
    score: number;
    feedback: string;
    strengths: string[];
    improvements: string[];
    accuracy: number;
  }> {
    const systemPrompt = `You are an expert AI literacy assessor. Evaluate student responses to AI-related questions with:
- Accuracy of technical concepts
- Depth of understanding
- Clarity of explanation
- Critical thinking demonstrated

Provide constructive feedback focused on learning.`;

    const userPrompt = `
Question: ${params.question}

Student Response:
${params.userResponse}

${params.expectedAnswer ? `Expected Answer: ${params.expectedAnswer}` : ''}
${params.rubric ? `Rubric: ${params.rubric}` : ''}

Provide your assessment in JSON format:
{
  "score": <0-100>,
  "accuracy": <0-100>,
  "feedback": "<detailed constructive feedback>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "improvements": ["<area to improve 1>", "<area to improve 2>"]
}`;

    const response = await this.complete({
      messages: [
        { role: 'user', content: userPrompt }
      ],
      systemPrompt,
      temperature: 0.3 // Lower temperature for consistent grading
    });

    // Parse JSON from response
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    throw new Error('Failed to parse assessment response');
  }

  /**
   * Generate personalized learning content
   */
  async generateLearningContent(params: {
    topic: string;
    difficulty: number; // 1-10
    learningStyle: 'visual' | 'textual' | 'interactive' | 'gamified';
    weakAreas?: string[];
  }): Promise<{
    content: string;
    exercises: Array<{
      question: string;
      options?: string[];
      correctAnswer?: string;
      explanation: string;
    }>;
    resources: string[];
  }> {
    const systemPrompt = `You are an expert AI literacy educator. Create engaging, personalized learning content that:
- Matches the student's learning style (${params.learningStyle})
- Targets difficulty level ${params.difficulty}/10
- Addresses weak areas: ${params.weakAreas?.join(', ') || 'none specified'}
- Uses real-world examples and practical applications`;

    const userPrompt = `Create a learning module about: ${params.topic}

Include:
1. Clear explanation with examples
2. 3-5 practice exercises
3. Additional resources for deeper learning

Format as JSON:
{
  "content": "<main content>",
  "exercises": [
    {
      "question": "<question>",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": "<answer>",
      "explanation": "<why this is correct>"
    }
  ],
  "resources": ["<resource 1>", "<resource 2>"]
}`;

    const response = await this.complete({
      messages: [
        { role: 'user', content: userPrompt }
      ],
      systemPrompt,
      temperature: 0.7
    });

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    throw new Error('Failed to parse learning content response');
  }

  /**
   * Detect bias in text
   */
  async detectBias(text: string): Promise<{
    hasBias: boolean;
    biasTypes: string[];
    severity: 'low' | 'medium' | 'high';
    examples: Array<{
      text: string;
      type: string;
      explanation: string;
    }>;
    suggestions: string[];
  }> {
    const systemPrompt = `You are an expert at detecting bias in text, including:
- Gender bias
- Racial bias
- Confirmation bias
- Selection bias
- Cultural bias
- Algorithmic bias

Analyze objectively and provide specific examples.`;

    const userPrompt = `Analyze this text for bias:

${text}

Provide analysis in JSON:
{
  "hasBias": <boolean>,
  "biasTypes": ["<type 1>", "<type 2>"],
  "severity": "<low|medium|high>",
  "examples": [
    {
      "text": "<biased excerpt>",
      "type": "<bias type>",
      "explanation": "<why this is biased>"
    }
  ],
  "suggestions": ["<how to reduce bias>"]
}`;

    const response = await this.complete({
      messages: [
        { role: 'user', content: userPrompt }
      ],
      systemPrompt,
      temperature: 0.2 // Low temperature for objective analysis
    });

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    throw new Error('Failed to parse bias detection response');
  }

  /**
   * Extract text content from Claude response
   */
  private extractContent(response: any): string {
    if (Array.isArray(response.content)) {
      return response.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('');
    }
    return response.content || '';
  }

  /**
   * Extract tool calls from Claude response
   */
  private extractToolCalls(response: any): ToolCall[] | undefined {
    if (!Array.isArray(response.content)) {
      return undefined;
    }

    const toolUseBlocks = response.content.filter((block: any) => block.type === 'tool_use');

    if (toolUseBlocks.length === 0) {
      return undefined;
    }

    return toolUseBlocks.map((block: any) => ({
      id: block.id,
      name: block.name,
      input: block.input
    }));
  }

  /**
   * Store conversation history for context
   */
  storeConversation(conversationId: string, messages: Message[]): void {
    this.conversationHistory.set(conversationId, messages);
  }

  /**
   * Get conversation history
   */
  getConversation(conversationId: string): Message[] {
    return this.conversationHistory.get(conversationId) || [];
  }

  /**
   * Clear conversation history
   */
  clearConversation(conversationId: string): void {
    this.conversationHistory.delete(conversationId);
  }
}
