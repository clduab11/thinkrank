// London School TDD Test Setup
// This setup emphasizes mockist approach with extensive use of test doubles

import { Pool } from 'pg';
import { Logger } from 'pino';
import { EventBus } from '../types/domain.types';

// Global test configuration
beforeAll(async () => {
  // Setup test environment
  process.env['NODE_ENV'] = 'test';
  process.env['LOG_LEVEL'] = 'silent';
});

afterAll(async () => {
  // Cleanup test environment
});

beforeEach(() => {
  // Clear all mocks before each test (London School principle)
  jest.clearAllMocks();
  jest.resetAllMocks();
  jest.restoreAllMocks();
});

// Mock factories following London School patterns
export const createMockLogger = (): jest.Mocked<Logger> => {
  return {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
    level: 'info',
    child: jest.fn().mockReturnThis(),
    silent: jest.fn(),
    assignWithLevel: jest.fn(),
    assign: jest.fn()
  } as any;
};

export const createMockDatabase = (): jest.Mocked<Pool> => {
  const mockClient = {
    query: jest.fn(),
    release: jest.fn(),
    end: jest.fn()
  };

  return {
    connect: jest.fn().mockResolvedValue(mockClient),
    query: jest.fn(),
    end: jest.fn(),
    totalCount: 0,
    idleCount: 0,
    waitingCount: 0
  } as any;
};

export const createMockEventBus = (): jest.Mocked<EventBus> => {
  return {
    publish: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn()
  };
};

// Test data builders (Builder pattern for test data)
export class ContentRequestBuilder {
  private request = {
    type: 'text' as 'text' | 'image',
    difficulty: 1,
    topic: 'test topic',
    userId: 'test-user-id',
    provider: 'openai' as 'openai' | 'anthropic',
    metadata: {}
  };

  withType(type: 'text' | 'image'): this {
    this.request.type = type;
    return this;
  }

  withDifficulty(difficulty: number): this {
    this.request.difficulty = difficulty;
    return this;
  }

  withTopic(topic: string): this {
    this.request.topic = topic;
    return this;
  }

  withUserId(userId: string): this {
    this.request.userId = userId;
    return this;
  }

  withProvider(provider: 'openai' | 'anthropic'): this {
    this.request.provider = provider;
    return this;
  }

  withMetadata(metadata: Record<string, any>): this {
    this.request.metadata = metadata;
    return this;
  }

  build() {
    return { ...this.request };
  }
}

export class ResearchProblemBuilder {
  private problem = {
    problemType: 'bias_detection' as const,
    title: 'Test Problem',
    description: 'Test Description',
    difficultyLevel: 1,
    institutionId: 'test-institution',
    institutionName: 'Test Institution',
    problemData: {},
    tags: ['test'],
    metadata: {
      difficulty: 'beginner' as const,
      estimatedTime: 120,
      gameCompatibility: {
        rapidFire: true,
        comparison: true,
        ranking: false,
        scenarioBased: true,
        patternRecognition: true
      },
      learningObjectives: ['test objective']
    }
  };

  withProblemType(type: 'bias_detection' | 'alignment' | 'context_evaluation'): this {
    this.problem.problemType = type as any;
    return this;
  }

  withTitle(title: string): this {
    this.problem.title = title;
    return this;
  }

  withDifficultyLevel(level: number): this {
    this.problem.difficultyLevel = level;
    return this;
  }

  withInstitution(id: string, name: string): this {
    this.problem.institutionId = id;
    this.problem.institutionName = name;
    return this;
  }

  withTags(tags: string[]): this {
    this.problem.tags = tags;
    return this;
  }

  build() {
    return { ...this.problem };
  }
}

// Mock AI Providers following London School approach
export const createMockOpenAIProvider = () => {
  return {
    generateText: jest.fn().mockResolvedValue('Generated text content'),
    generateImage: jest.fn().mockResolvedValue('https://example.com/image.jpg'),
    generateExplanation: jest.fn().mockResolvedValue('Explanation text')
  };
};

export const createMockAnthropicProvider = () => {
  return {
    generateText: jest.fn().mockResolvedValue('Anthropic generated text')
  };
};

export const createMockDetectionProvider = () => {
  return {
    detectText: jest.fn().mockResolvedValue({
      isAIGenerated: false,
      confidence: 0.8,
      explanation: 'Text appears to be human-generated'
    }),
    detectImage: jest.fn().mockResolvedValue({
      isAIGenerated: false,
      confidence: 0.9,
      explanation: 'Image appears to be human-generated'
    }),
    analyzeComplexity: jest.fn().mockResolvedValue(0.6)
  };
};

// Custom Jest matchers for domain objects
declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveUncommittedEvents(count?: number): R;
      toHaveEventOfType(eventType: string): R;
      toBeValidAggregate(): R;
    }
  }
}

expect.extend({
  toHaveUncommittedEvents(received: any, count?: number) {
    const events = received.getUncommittedEvents ? received.getUncommittedEvents() : [];
    const pass = count !== undefined ? events.length === count : events.length > 0;
    
    return {
      message: () => count !== undefined 
        ? `expected aggregate to have ${count} uncommitted events, but had ${events.length}`
        : `expected aggregate to have uncommitted events, but had ${events.length}`,
      pass
    };
  },

  toHaveEventOfType(received: any, eventType: string) {
    const events = received.getUncommittedEvents ? received.getUncommittedEvents() : [];
    const hasEventType = events.some((event: any) => event.eventType === eventType);
    
    return {
      message: () => `expected aggregate to have event of type '${eventType}', but events were: ${events.map((e: any) => e.eventType).join(', ')}`,
      pass: hasEventType
    };
  },

  toBeValidAggregate(received: any) {
    const hasId = received.id !== undefined;
    const hasVersion = received.version !== undefined;
    const hasGetUncommittedEvents = typeof received.getUncommittedEvents === 'function';
    
    return {
      message: () => `expected object to be a valid aggregate (have id, version, and getUncommittedEvents method)`,
      pass: hasId && hasVersion && hasGetUncommittedEvents
    };
  }
});

// London School test helpers
export const assertMockCalledWith = (mock: jest.Mock, ...args: any[]) => {
  expect(mock).toHaveBeenCalledWith(...args);
};

export const assertMockCalledTimes = (mock: jest.Mock, times: number) => {
  expect(mock).toHaveBeenCalledTimes(times);
};

export const assertMockNotCalled = (mock: jest.Mock) => {
  expect(mock).not.toHaveBeenCalled();
};

// Spy on collaborators pattern
export const spyOnCollaborator = <T extends object>(obj: T, method: keyof T) => {
  return jest.spyOn(obj, method);
};

// Test isolation helpers
export const isolateFunction = <T extends (...args: any[]) => any>(fn: T): jest.MockedFunction<T> => {
  return jest.fn(fn) as jest.MockedFunction<T>;
};

// Behavior verification helpers
export const verifyInteraction = (mock: jest.Mock, interaction: { method: string; args?: any[]; times?: number }) => {
  if (interaction.times !== undefined) {
    expect(mock).toHaveBeenCalledTimes(interaction.times);
  }
  if (interaction.args !== undefined) {
    expect(mock).toHaveBeenCalledWith(...interaction.args);
  }
};

export const verifyNoInteraction = (mock: jest.Mock) => {
  expect(mock).not.toHaveBeenCalled();
};

// State verification helpers
export const verifyState = (object: any, expectedState: Record<string, any>) => {
  for (const [key, value] of Object.entries(expectedState)) {
    expect(object[key]).toEqual(value);
  }
};

// Error simulation helpers
export const simulateError = (mock: jest.Mock, error: Error | string) => {
  const errorObject = typeof error === 'string' ? new Error(error) : error;
  mock.mockRejectedValue(errorObject);
};

export const simulateSuccess = (mock: jest.Mock, result?: any) => {
  mock.mockResolvedValue(result);
};