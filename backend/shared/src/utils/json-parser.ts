/**
 * Safe JSON parsing utilities with comprehensive error handling
 *
 * This module provides robust JSON parsing with Zod schema validation,
 * preventing service crashes from malformed responses.
 *
 * @module json-parser
 * @see MAJOR-03-claude-json-parsing.md
 * @created 2024-11-16
 * @updated 2024-11-16
 */

import { z, ZodSchema } from 'zod';

// Default logger implementation using console
const logger = {
  info: (...args: any[]) => console.info('[json-parser]', ...args),
  warn: (...args: any[]) => console.warn('[json-parser]', ...args),
  error: (...args: any[]) => console.error('[json-parser]', ...args),
  debug: (...args: any[]) => console.debug('[json-parser]', ...args),
};

export interface ParseOptions {
  /** Fallback value if parsing fails */
  fallback?: any;
  /** Number of characters to log from failed JSON */
  logSampleSize?: number;
  /** Whether to throw on parsing error */
  throwOnError?: boolean;
}

/**
 * Custom error for JSON parsing failures
 */
export class JSONParsingError extends Error {
  constructor(
    message: string,
    public readonly jsonSample: string
  ) {
    super(`JSON parsing failed: ${message}`);
    this.name = 'JSONParsingError';
  }
}

/**
 * Custom error for JSON validation failures
 */
export class JSONValidationError extends Error {
  constructor(
    public readonly errors: z.ZodIssue[],
    public readonly data: any
  ) {
    super(`JSON validation failed: ${errors.map(e => e.message).join(', ')}`);
    this.name = 'JSONValidationError';
  }
}

/**
 * Safe JSON parser with comprehensive error handling
 */
export class SafeJSONParser {
  /**
   * Parse JSON string with error handling
   *
   * @param json - JSON string to parse
   * @param options - Parsing options
   * @returns Parsed data or fallback value
   *
   * @example
   * ```typescript
   * const result = SafeJSONParser.parse('{"key": "value"}');
   * // Result: { key: 'value' }
   *
   * const failed = SafeJSONParser.parse('invalid', { fallback: {} });
   * // Result: {}
   * ```
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
   *
   * @param json - JSON string to parse
   * @param schema - Zod schema for validation
   * @param options - Parsing options
   * @returns Validated data or fallback value
   *
   * @example
   * ```typescript
   * const schema = z.object({ name: z.string(), age: z.number() });
   * const result = SafeJSONParser.parseWithValidation(
   *   '{"name": "John", "age": 30}',
   *   schema
   * );
   * // Result: { name: 'John', age: 30 }
   * ```
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
   *
   * @param jsonOrPromise - JSON string or Promise resolving to JSON
   * @param schema - Optional Zod schema for validation
   * @param retries - Number of retry attempts
   * @returns Parsed and validated data
   *
   * @example
   * ```typescript
   * const result = await SafeJSONParser.parseWithRetry(
   *   fetch('/api/data').then(r => r.text()),
   *   schema,
   *   3
   * );
   * ```
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
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, i)));
      }
    }

    return null;
  }

  /**
   * Parse JSON with type guard validation
   *
   * @param json - JSON string to parse
   * @param typeGuard - Type guard function
   * @param options - Parsing options
   * @returns Parsed data matching type guard
   *
   * @example
   * ```typescript
   * function isUser(value: any): value is User {
   *   return typeof value?.name === 'string';
   * }
   *
   * const user = SafeJSONParser.parseAs(jsonString, isUser);
   * ```
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

      if (options.throwOnError) {
        throw new Error(`Type guard ${typeGuard.name} failed`);
      }

      return options.fallback ?? null;
    }

    return parsed;
  }

  /**
   * Safely stringify data to JSON
   *
   * @param data - Data to stringify
   * @param fallback - Fallback value if stringification fails
   * @returns JSON string or fallback
   *
   * @example
   * ```typescript
   * const json = SafeJSONParser.stringify({ key: 'value' });
   * // Result: '{"key":"value"}'
   * ```
   */
  static stringify(data: any, fallback = '{}'): string {
    try {
      return JSON.stringify(data);
    } catch (error) {
      logger.error('JSON stringification failed', {
        error: error instanceof Error ? error.message : 'Unknown',
        dataType: typeof data
      });
      return fallback;
    }
  }

  /**
   * Pretty print JSON with indentation
   *
   * @param data - Data to stringify
   * @param indent - Number of spaces for indentation
   * @returns Formatted JSON string
   *
   * @example
   * ```typescript
   * const pretty = SafeJSONParser.prettyPrint({ key: 'value' }, 2);
   * // Result: '{\n  "key": "value"\n}'
   * ```
   */
  static prettyPrint(data: any, indent = 2): string {
    try {
      return JSON.stringify(data, null, indent);
    } catch (error) {
      logger.error('JSON pretty print failed', {
        error: error instanceof Error ? error.message : 'Unknown'
      });
      return this.stringify(data);
    }
  }

  /**
   * Check if string is valid JSON
   *
   * @param json - String to check
   * @returns True if valid JSON
   *
   * @example
   * ```typescript
   * SafeJSONParser.isValidJSON('{"key": "value"}'); // true
   * SafeJSONParser.isValidJSON('invalid'); // false
   * ```
   */
  static isValidJSON(json: string): boolean {
    try {
      JSON.parse(json);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Parse multiple JSON strings, returning only successful parses
   *
   * @param jsonStrings - Array of JSON strings
   * @returns Array of successfully parsed objects
   *
   * @example
   * ```typescript
   * const results = SafeJSONParser.parseMultiple([
   *   '{"a": 1}',
   *   'invalid',
   *   '{"b": 2}'
   * ]);
   * // Result: [{ a: 1 }, { b: 2 }]
   * ```
   */
  static parseMultiple(jsonStrings: string[]): any[] {
    return jsonStrings
      .map(json => this.parse(json))
      .filter(result => result !== null);
  }
}

// Export convenience functions
export const { parse, parseWithValidation, parseWithRetry, parseAs, stringify } = SafeJSONParser;
