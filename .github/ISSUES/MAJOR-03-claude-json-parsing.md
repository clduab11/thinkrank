# [MAJOR] Claude Adapter Brittle JSON Parsing

## Labels
`major`, `bug`, `error-handling`, `reliability`, `pr-9`

## Priority
🟡 **MAJOR** - High priority

## Description
Claude adapter's JSON parsing lacks centralized error handling, causing service crashes and poor error recovery when parsing malformed responses.

## Current Behavior
- Direct `JSON.parse()` calls without try-catch
- Unhandled exceptions bubble up and crash services
- No fallback mechanisms
- Poor error messages for debugging
- No validation of parsed data structure

## Expected Behavior
- Centralized JSON parsing with comprehensive error handling
- Schema validation using Zod
- Graceful error recovery with fallbacks
- Detailed error logging for debugging
- Type-safe parsing results

## Impact
- **Severity:** MEDIUM
- **Service Stability:** Service crashes on malformed JSON
- **User Experience:** Poor error messages, unexpected failures
- **Debugging:** Difficult to trace parsing failures

## Files Affected
- `backend/services/ai-service/src/adapters/claude-adapter.ts`
- Any service parsing external API responses

## Proposed Solution

### 1. Create Centralized JSON Parser
```typescript
// backend/shared/src/utils/json-parser.ts

import { z, ZodSchema } from 'zod';
import { Logger } from './logger';

const logger = Logger.getInstance('json-parser');

export interface ParseOptions {
  fallback?: any;
  logSampleSize?: number;
  throwOnError?: boolean;
}

export class SafeJSONParser {
  /**
   * Parse JSON string with error handling
   */
  static parse<T = any>(
    json: string,
    options: ParseOptions = {}
  ): T | null {
    const {
      fallback = null,
      logSampleSize = 100,
      throwOnError = false
    } = options;

    try {
      return JSON.parse(json) as T;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('JSON parsing failed', {
        error: errorMessage,
        jsonSample: json.substring(0, logSampleSize),
        jsonLength: json.length
      });

      if (throwOnError) {
        throw new JSONParsingError(errorMessage, json.substring(0, logSampleSize));
      }

      return fallback;
    }
  }

  /**
   * Parse and validate JSON with Zod schema
   */
  static parseWithValidation<T>(
    json: string,
    schema: ZodSchema<T>,
    options: ParseOptions = {}
  ): T | null {
    const parsed = this.parse(json, options);

    if (parsed === null) {
      return options.fallback ?? null;
    }

    const result = schema.safeParse(parsed);

    if (!result.success) {
      logger.error('JSON validation failed', {
        errors: result.error.errors,
        data: parsed
      });

      if (options.throwOnError) {
        throw new JSONValidationError(result.error.errors, parsed);
      }

      return options.fallback ?? null;
    }

    return result.data;
  }

  /**
   * Async parse with retry logic
   */
  static async parseWithRetry<T>(
    jsonOrPromise: string | Promise<string>,
    schema?: ZodSchema<T>,
    retries = 3
  ): Promise<T | null> {
    const json = typeof jsonOrPromise === 'string'
      ? jsonOrPromise
      : await jsonOrPromise;

    for (let i = 0; i < retries; i++) {
      try {
        if (schema) {
          return this.parseWithValidation(json, schema, { throwOnError: true });
        }
        return this.parse(json, { throwOnError: true });
      } catch (error) {
        if (i === retries - 1) {
          logger.error('JSON parsing failed after retries', {
            retries,
            error: error instanceof Error ? error.message : 'Unknown'
          });
          return null;
        }
        await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
      }
    }

    return null;
  }

  /**
   * Parse JSON with type guards
   */
  static parseAs<T>(
    json: string,
    typeGuard: (value: any) => value is T,
    options: ParseOptions = {}
  ): T | null {
    const parsed = this.parse(json, options);

    if (parsed === null) {
      return null;
    }

    if (!typeGuard(parsed)) {
      logger.error('Type guard failed for parsed JSON', {
        parsed,
        expectedType: typeGuard.name
      });
      return options.fallback ?? null;
    }

    return parsed;
  }
}

// Custom error classes
export class JSONParsingError extends Error {
  constructor(
    message: string,
    public readonly jsonSample: string
  ) {
    super(`JSON parsing failed: ${message}`);
    this.name = 'JSONParsingError';
  }
}

export class JSONValidationError extends Error {
  constructor(
    public readonly errors: z.ZodIssue[],
    public readonly data: any
  ) {
    super(`JSON validation failed: ${errors.map(e => e.message).join(', ')}`);
    this.name = 'JSONValidationError';
  }
}
```

### 2. Update Claude Adapter
```typescript
// backend/services/ai-service/src/adapters/claude-adapter.ts

import { SafeJSONParser } from '@shared/utils/json-parser';
import { z } from 'zod';

// Define response schema
const ClaudeResponseSchema = z.object({
  id: z.string(),
  type: z.literal('message'),
  role: z.literal('assistant'),
  content: z.array(z.object({
    type: z.string(),
    text: z.string().optional()
  })),
  model: z.string(),
  stop_reason: z.string().optional(),
  usage: z.object({
    input_tokens: z.number(),
    output_tokens: z.number()
  })
});

type ClaudeResponse = z.infer<typeof ClaudeResponseSchema>;

// ❌ BEFORE
async processResponse(responseText: string): Promise<any> {
  const data = JSON.parse(responseText); // Can throw!
  return data.content[0].text;
}

// ✅ AFTER
async processResponse(responseText: string): Promise<string | null> {
  const data = SafeJSONParser.parseWithValidation(
    responseText,
    ClaudeResponseSchema,
    {
      fallback: null,
      throwOnError: false
    }
  );

  if (!data) {
    logger.error('Failed to parse Claude response');
    return null;
  }

  return data.content[0]?.text ?? null;
}

// ✅ WITH RETRY
async processResponseWithRetry(responseText: string): Promise<string | null> {
  const data = await SafeJSONParser.parseWithRetry(
    responseText,
    ClaudeResponseSchema,
    3 // retries
  );

  return data?.content[0]?.text ?? null;
}
```

### 3. Add Comprehensive Tests
```typescript
// backend/shared/src/utils/__tests__/json-parser.test.ts

describe('SafeJSONParser', () => {
  describe('parse', () => {
    it('should parse valid JSON', () => {
      const result = SafeJSONParser.parse('{"key": "value"}');
      expect(result).toEqual({ key: 'value' });
    });

    it('should return null for invalid JSON', () => {
      const result = SafeJSONParser.parse('invalid json');
      expect(result).toBeNull();
    });

    it('should use fallback value', () => {
      const result = SafeJSONParser.parse('invalid', {
        fallback: { default: true }
      });
      expect(result).toEqual({ default: true });
    });

    it('should throw when throwOnError is true', () => {
      expect(() => {
        SafeJSONParser.parse('invalid', { throwOnError: true });
      }).toThrow(JSONParsingError);
    });
  });

  describe('parseWithValidation', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number()
    });

    it('should validate and parse correct data', () => {
      const json = '{"name": "John", "age": 30}';
      const result = SafeJSONParser.parseWithValidation(json, schema);
      expect(result).toEqual({ name: 'John', age: 30 });
    });

    it('should return null for invalid schema', () => {
      const json = '{"name": "John", "age": "thirty"}';
      const result = SafeJSONParser.parseWithValidation(json, schema);
      expect(result).toBeNull();
    });

    it('should throw validation error when required', () => {
      const json = '{"name": "John"}';
      expect(() => {
        SafeJSONParser.parseWithValidation(json, schema, {
          throwOnError: true
        });
      }).toThrow(JSONValidationError);
    });
  });

  describe('parseWithRetry', () => {
    it('should retry on parsing failure', async () => {
      const validJson = '{"success": true}';
      const result = await SafeJSONParser.parseWithRetry(validJson);
      expect(result).toEqual({ success: true });
    });

    it('should return null after max retries', async () => {
      const invalidJson = 'definitely not json';
      const result = await SafeJSONParser.parseWithRetry(invalidJson, undefined, 2);
      expect(result).toBeNull();
    });
  });
});
```

## Acceptance Criteria
- [ ] Create centralized JSON parsing utility with error handling
- [ ] Add Zod schema validation support
- [ ] Implement retry logic for transient failures
- [ ] Replace all direct `JSON.parse()` calls in Claude adapter
- [ ] Add comprehensive error logging
- [ ] Add unit tests (100% coverage)
- [ ] Add integration tests with real API responses
- [ ] Document JSON parsing best practices
- [ ] Add pre-commit hook to detect unsafe JSON.parse()

## Testing Requirements
1. **Unit Tests:**
   - Valid JSON parsing
   - Invalid JSON handling
   - Schema validation
   - Fallback values
   - Error throwing
   - Retry logic

2. **Integration Tests:**
   - Real Claude API responses
   - Malformed API responses
   - Network timeout scenarios
   - Large JSON payloads

3. **Performance Tests:**
   - Parsing speed benchmarks
   - Memory usage with large JSON
   - Retry performance impact

## Migration Path
1. Create SafeJSONParser utility
2. Add Zod schemas for Claude responses
3. Update Claude adapter incrementally
4. Add tests for each update
5. Deploy to staging
6. Monitor error rates
7. Deploy to production

## Estimated Effort
3 hours

## Related Issues
- PR #9: Repository analysis
- All services parsing external APIs

## References
- Zod Documentation: https://zod.dev/
- JSON Parsing Best Practices
- Error Handling Patterns in TypeScript
