import { BaseAggregate } from '../base-aggregate';
import { DomainEvent, ContentGeneration } from '../../types/domain.types';

export class ContentGenerationAggregate extends BaseAggregate {
  private requests: Map<string, ContentGeneration.ContentRequest> = new Map();
  private generatedContent: Map<string, ContentGeneration.GeneratedContent> = new Map();

  public requestContent(
    type: 'text' | 'image',
    difficulty: number,
    topic: string,
    userId: string,
    provider?: 'openai' | 'anthropic',
    metadata?: Record<string, any>
  ): string {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const event = this.createEvent('ContentRequested', {
      requestId,
      type,
      difficulty,
      topic,
      userId,
      provider,
      metadata
    });

    this.applyEvent(event);
    return requestId;
  }

  public generateContent(
    requestId: string,
    content: string,
    model: string,
    metadata: any
  ): string {
    const request = this.requests.get(requestId);
    if (!request) {
      throw new Error(`Content request ${requestId} not found`);
    }

    const contentId = `content_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const event = this.createEvent('ContentGenerated', {
      requestId,
      contentId,
      content,
      metadata: {
        model,
        difficulty: request.difficulty,
        topic: request.topic,
        timestamp: new Date().toISOString(),
        ...metadata
      }
    });

    this.applyEvent(event);
    return contentId;
  }

  public validateContent(
    contentId: string,
    validationResult: ContentGeneration.ValidationResult
  ): void {
    const content = this.generatedContent.get(contentId);
    if (!content) {
      throw new Error(`Content ${contentId} not found`);
    }

    const event = this.createEvent('ContentValidated', {
      contentId,
      validationResult
    });

    this.applyEvent(event);
  }

  public getContentRequest(requestId: string): ContentGeneration.ContentRequest | undefined {
    return this.requests.get(requestId);
  }

  public getGeneratedContent(contentId: string): ContentGeneration.GeneratedContent | undefined {
    return this.generatedContent.get(contentId);
  }

  public getAllRequests(): ContentGeneration.ContentRequest[] {
    return Array.from(this.requests.values());
  }

  public getAllGeneratedContent(): ContentGeneration.GeneratedContent[] {
    return Array.from(this.generatedContent.values());
  }

  protected when(event: DomainEvent): void {
    switch (event.eventType) {
      case 'ContentRequested':
        this.onContentRequested(event as ContentGeneration.ContentRequestedEvent);
        break;
      case 'ContentGenerated':
        this.onContentGenerated(event as ContentGeneration.ContentGeneratedEvent);
        break;
      case 'ContentValidated':
        this.onContentValidated(event as ContentGeneration.ContentValidatedEvent);
        break;
    }
  }

  private onContentRequested(event: ContentGeneration.ContentRequestedEvent): void {
    const { requestId, type, difficulty, topic, userId } = event.eventData;
    
    const request: ContentGeneration.ContentRequest = {
      id: requestId,
      type,
      difficulty,
      topic,
      userId,
      metadata: event.metadata
    };

    this.requests.set(requestId, request);
  }

  private onContentGenerated(event: ContentGeneration.ContentGeneratedEvent): void {
    const { requestId, contentId, content, metadata } = event.eventData;
    
    const generatedContent: ContentGeneration.GeneratedContent = {
      id: contentId,
      requestId,
      type: this.requests.get(requestId)?.type || 'text',
      content,
      metadata
    };

    this.generatedContent.set(contentId, generatedContent);
  }

  private onContentValidated(event: ContentGeneration.ContentValidatedEvent): void {
    const { contentId, validationResult } = event.eventData;
    const content = this.generatedContent.get(contentId);
    
    if (content) {
      content.validationResult = validationResult;
      this.generatedContent.set(contentId, content);
    }
  }
}