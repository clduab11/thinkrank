// Domain-Driven Design Types for AI Domain Service

export interface DomainEvent {
  id: string;
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  eventData: any;
  version: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface AggregateRoot {
  id: string;
  version: number;
  uncommittedEvents: DomainEvent[];
  
  getUncommittedEvents(): DomainEvent[];
  markEventsAsCommitted(): void;
  loadFromHistory(events: DomainEvent[]): void;
}

// Content Generation Bounded Context
export namespace ContentGeneration {
  export interface ContentRequest {
    id: string;
    type: 'text' | 'image';
    difficulty: number;
    topic: string;
    provider?: 'openai' | 'anthropic';
    userId: string;
    metadata?: Record<string, any>;
  }

  export interface GeneratedContent {
    id: string;
    requestId: string;
    type: 'text' | 'image';
    content: string;
    metadata: {
      model: string;
      difficulty: number;
      topic: string;
      complexity?: number;
      timestamp: string;
    };
    validationResult?: ValidationResult;
  }

  export interface ValidationResult {
    isValid: boolean;
    issues: string[];
    score: number;
  }

  // Events
  export interface ContentRequestedEvent extends DomainEvent {
    eventType: 'ContentRequested';
    eventData: {
      requestId: string;
      type: 'text' | 'image';
      difficulty: number;
      topic: string;
      userId: string;
    };
  }

  export interface ContentGeneratedEvent extends DomainEvent {
    eventType: 'ContentGenerated';
    eventData: {
      requestId: string;
      contentId: string;
      content: string;
      metadata: any;
    };
  }

  export interface ContentValidatedEvent extends DomainEvent {
    eventType: 'ContentValidated';
    eventData: {
      contentId: string;
      validationResult: ValidationResult;
    };
  }
}

// Research Problems Bounded Context
export namespace ResearchProblems {
  export enum ProblemType {
    BIAS_DETECTION = 'bias_detection',
    ALIGNMENT = 'alignment',
    CONTEXT_EVALUATION = 'context_evaluation'
  }

  export interface ResearchProblem {
    id: string;
    problemId: string;
    institutionId: string;
    problemType: ProblemType;
    title: string;
    description: string;
    difficultyLevel: number;
    problemData: any;
    validationCriteria: ValidationCriteria;
    tags: string[];
    metadata: ProblemMetadata;
    active: boolean;
    totalContributions: number;
    qualityThreshold: number;
    createdAt: Date;
    updatedAt: Date;
  }

  export interface ValidationCriteria {
    requiredAccuracy: number;
    minimumContributions: number;
    expertValidationRequired: boolean;
    peerReviewThreshold: number;
    validationMethod: 'hybrid' | 'peer_review' | 'expert';
  }

  export interface ProblemMetadata {
    difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    estimatedTime: number;
    gameCompatibility: GameCompatibility;
    learningObjectives: string[];
  }

  export interface GameCompatibility {
    rapidFire: boolean;
    comparison: boolean;
    ranking: boolean;
    scenarioBased: boolean;
    patternRecognition: boolean;
  }

  // Events
  export interface ProblemCreatedEvent extends DomainEvent {
    eventType: 'ProblemCreated';
    eventData: {
      problemId: string;
      problemType: ProblemType;
      title: string;
      difficultyLevel: number;
    };
  }

  export interface ProblemTransformedEvent extends DomainEvent {
    eventType: 'ProblemTransformed';
    eventData: {
      problemId: string;
      gameType: string;
      playerLevel: number;
      gameProblemId: string;
    };
  }
}

// AI Detection Bounded Context
export namespace AIDetection {
  export interface DetectionRequest {
    id: string;
    type: 'text' | 'image';
    content: string;
    userId: string;
    timestamp: Date;
  }

  export interface DetectionResult {
    id: string;
    requestId: string;
    isAIGenerated: boolean;
    confidence: number;
    model?: string;
    explanation: string;
    metadata: {
      processingTime: number;
      algorithm: string;
      features: string[];
    };
  }

  // Events
  export interface DetectionRequestedEvent extends DomainEvent {
    eventType: 'DetectionRequested';
    eventData: {
      requestId: string;
      type: 'text' | 'image';
      contentLength: number;
      userId: string;
    };
  }

  export interface DetectionCompletedEvent extends DomainEvent {
    eventType: 'DetectionCompleted';
    eventData: {
      requestId: string;
      isAIGenerated: boolean;
      confidence: number;
      processingTime: number;
    };
  }
}

// Cross-cutting concerns
export interface Repository<T extends AggregateRoot> {
  getById(id: string): Promise<T | null>;
  save(aggregate: T): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface EventStore {
  saveEvents(aggregateId: string, events: DomainEvent[], expectedVersion: number): Promise<void>;
  getEvents(aggregateId: string, fromVersion?: number): Promise<DomainEvent[]>;
}

export interface EventBus {
  publish(events: DomainEvent[]): Promise<void>;
  subscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>): void;
}

export interface MessageQueue {
  publish(exchange: string, routingKey: string, message: any): Promise<void>;
  subscribe(queue: string, handler: (message: any) => Promise<void>): Promise<void>;
}

// Circuit Breaker Pattern
export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
}

export enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

export interface CircuitBreaker {
  state: CircuitBreakerState;
  execute<T>(operation: () => Promise<T>): Promise<T>;
}