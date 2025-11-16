/**
 * Comprehensive test suite for SafeJSONParser
 * Ensures robust error handling and prevents service crashes
 *
 * @see backend/shared/src/utils/json-parser.ts
 */

import { z } from 'zod';
import {
  SafeJSONParser,
  JSONParsingError,
  JSONValidationError
} from '../json-parser';

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

    it('should use fallback value on error', () => {
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

    it('should parse arrays', () => {
      const result = SafeJSONParser.parse('[1, 2, 3]');
      expect(result).toEqual([1, 2, 3]);
    });

    it('should parse nested objects', () => {
      const json = '{"user": {"name": "John", "age": 30}}';
      const result = SafeJSONParser.parse(json);
      expect(result).toEqual({
        user: { name: 'John', age: 30 }
      });
    });

    it('should handle empty strings', () => {
      const result = SafeJSONParser.parse('');
      expect(result).toBeNull();
    });

    it('should handle whitespace', () => {
      const result = SafeJSONParser.parse('   \n  \t  ');
      expect(result).toBeNull();
    });
  });

  describe('parseWithValidation', () => {
    const userSchema = z.object({
      name: z.string(),
      age: z.number()
    });

    it('should validate and parse correct data', () => {
      const json = '{"name": "John", "age": 30}';
      const result = SafeJSONParser.parseWithValidation(json, userSchema);
      expect(result).toEqual({ name: 'John', age: 30 });
    });

    it('should return null for invalid schema', () => {
      const json = '{"name": "John", "age": "thirty"}';
      const result = SafeJSONParser.parseWithValidation(json, userSchema);
      expect(result).toBeNull();
    });

    it('should use fallback for validation failure', () => {
      const json = '{"name": "John"}';
      const fallback = { name: 'Default', age: 0 };
      const result = SafeJSONParser.parseWithValidation(json, userSchema, {
        fallback
      });
      expect(result).toEqual(fallback);
    });

    it('should throw validation error when required', () => {
      const json = '{"name": "John"}';
      expect(() => {
        SafeJSONParser.parseWithValidation(json, userSchema, {
          throwOnError: true
        });
      }).toThrow(JSONValidationError);
    });

    it('should validate complex nested schemas', () => {
      const complexSchema = z.object({
        user: z.object({
          name: z.string(),
          email: z.string().email()
        }),
        metadata: z.object({
          created: z.string(),
          tags: z.array(z.string())
        })
      });

      const json = JSON.stringify({
        user: { name: 'John', email: 'john@example.com' },
        metadata: { created: '2024-01-01', tags: ['test'] }
      });

      const result = SafeJSONParser.parseWithValidation(json, complexSchema);
      expect(result).not.toBeNull();
      expect(result?.user.email).toBe('john@example.com');
    });

    it('should handle optional fields', () => {
      const schema = z.object({
        required: z.string(),
        optional: z.string().optional()
      });

      const json = '{"required": "value"}';
      const result = SafeJSONParser.parseWithValidation(json, schema);
      expect(result).toEqual({ required: 'value' });
    });
  });

  describe('parseWithRetry', () => {
    it('should parse on first attempt', async () => {
      const json = '{"success": true}';
      const result = await SafeJSONParser.parseWithRetry(json);
      expect(result).toEqual({ success: true });
    });

    it('should return null after max retries', async () => {
      const invalidJson = 'definitely not json';
      const result = await SafeJSONParser.parseWithRetry(invalidJson, undefined, 2);
      expect(result).toBeNull();
    });

    it('should work with promises', async () => {
      const jsonPromise = Promise.resolve('{"data": "value"}');
      const result = await SafeJSONParser.parseWithRetry(jsonPromise);
      expect(result).toEqual({ data: 'value' });
    });

    it('should validate with schema', async () => {
      const schema = z.object({ id: z.number() });
      const json = '{"id": 123}';
      const result = await SafeJSONParser.parseWithRetry(json, schema);
      expect(result).toEqual({ id: 123 });
    });

    it('should handle schema validation failure', async () => {
      const schema = z.object({ id: z.number() });
      const json = '{"id": "not a number"}';
      const result = await SafeJSONParser.parseWithRetry(json, schema, 2);
      expect(result).toBeNull();
    });
  });

  describe('parseAs', () => {
    interface User {
      name: string;
      age: number;
    }

    function isUser(value: any): value is User {
      return (
        typeof value?.name === 'string' &&
        typeof value?.age === 'number'
      );
    }

    it('should parse with type guard validation', () => {
      const json = '{"name": "John", "age": 30}';
      const result = SafeJSONParser.parseAs(json, isUser);
      expect(result).toEqual({ name: 'John', age: 30 });
    });

    it('should return null when type guard fails', () => {
      const json = '{"name": "John", "age": "thirty"}';
      const result = SafeJSONParser.parseAs(json, isUser);
      expect(result).toBeNull();
    });

    it('should use fallback when type guard fails', () => {
      const json = '{"invalid": "data"}';
      const fallback = { name: 'Default', age: 0 };
      const result = SafeJSONParser.parseAs(json, isUser, { fallback });
      expect(result).toEqual(fallback);
    });

    it('should throw when throwOnError is true', () => {
      const json = '{"invalid": "data"}';
      expect(() => {
        SafeJSONParser.parseAs(json, isUser, { throwOnError: true });
      }).toThrow();
    });
  });

  describe('stringify', () => {
    it('should stringify objects', () => {
      const result = SafeJSONParser.stringify({ key: 'value' });
      expect(result).toBe('{"key":"value"}');
    });

    it('should stringify arrays', () => {
      const result = SafeJSONParser.stringify([1, 2, 3]);
      expect(result).toBe('[1,2,3]');
    });

    it('should use fallback for circular references', () => {
      const obj: any = { name: 'test' };
      obj.self = obj; // Circular reference

      const result = SafeJSONParser.stringify(obj, '{"error": "circular"}');
      expect(result).toBe('{"error": "circular"}');
    });

    it('should handle undefined', () => {
      const result = SafeJSONParser.stringify(undefined);
      expect(result).toBe('{}');
    });
  });

  describe('prettyPrint', () => {
    it('should format JSON with indentation', () => {
      const obj = { key: 'value', nested: { a: 1 } };
      const result = SafeJSONParser.prettyPrint(obj, 2);

      expect(result).toContain('\n');
      expect(result).toContain('  "key"');
    });

    it('should use custom indentation', () => {
      const obj = { key: 'value' };
      const result = SafeJSONParser.prettyPrint(obj, 4);

      expect(result).toContain('    "key"');
    });

    it('should fallback on circular reference', () => {
      const obj: any = { name: 'test' };
      obj.self = obj;

      const result = SafeJSONParser.prettyPrint(obj);
      expect(result).toBeTruthy();
    });
  });

  describe('isValidJSON', () => {
    it('should return true for valid JSON', () => {
      expect(SafeJSONParser.isValidJSON('{"key": "value"}')).toBe(true);
      expect(SafeJSONParser.isValidJSON('[1, 2, 3]')).toBe(true);
      expect(SafeJSONParser.isValidJSON('"string"')).toBe(true);
      expect(SafeJSONParser.isValidJSON('123')).toBe(true);
      expect(SafeJSONParser.isValidJSON('true')).toBe(true);
      expect(SafeJSONParser.isValidJSON('null')).toBe(true);
    });

    it('should return false for invalid JSON', () => {
      expect(SafeJSONParser.isValidJSON('invalid')).toBe(false);
      expect(SafeJSONParser.isValidJSON('{invalid}')).toBe(false);
      expect(SafeJSONParser.isValidJSON('')).toBe(false);
      expect(SafeJSONParser.isValidJSON('undefined')).toBe(false);
    });
  });

  describe('parseMultiple', () => {
    it('should parse multiple JSON strings', () => {
      const jsons = [
        '{"a": 1}',
        '{"b": 2}',
        '{"c": 3}'
      ];

      const results = SafeJSONParser.parseMultiple(jsons);
      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({ a: 1 });
      expect(results[2]).toEqual({ c: 3 });
    });

    it('should filter out invalid JSON', () => {
      const jsons = [
        '{"a": 1}',
        'invalid',
        '{"b": 2}',
        'also invalid',
        '{"c": 3}'
      ];

      const results = SafeJSONParser.parseMultiple(jsons);
      expect(results).toHaveLength(3);
      expect(results).toEqual([
        { a: 1 },
        { b: 2 },
        { c: 3 }
      ]);
    });

    it('should handle empty array', () => {
      const results = SafeJSONParser.parseMultiple([]);
      expect(results).toEqual([]);
    });

    it('should handle all invalid JSONs', () => {
      const jsons = ['invalid1', 'invalid2', 'invalid3'];
      const results = SafeJSONParser.parseMultiple(jsons);
      expect(results).toEqual([]);
    });
  });

  describe('Error classes', () => {
    it('should create JSONParsingError with sample', () => {
      const error = new JSONParsingError('Test error', '{"sample"');

      expect(error.message).toContain('Test error');
      expect(error.jsonSample).toBe('{"sample"');
      expect(error.name).toBe('JSONParsingError');
    });

    it('should create JSONValidationError with zod errors', () => {
      const zodErrors: z.ZodIssue[] = [
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          path: ['name'],
          message: 'Expected string, received number'
        }
      ];

      const error = new JSONValidationError(zodErrors, { name: 123 });

      expect(error.message).toContain('Expected string');
      expect(error.errors).toEqual(zodErrors);
      expect(error.data).toEqual({ name: 123 });
      expect(error.name).toBe('JSONValidationError');
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle Claude API response', () => {
      const claudeSchema = z.object({
        id: z.string(),
        type: z.literal('message'),
        content: z.array(z.object({
          type: z.string(),
          text: z.string().optional()
        }))
      });

      const response = JSON.stringify({
        id: 'msg_123',
        type: 'message',
        content: [{ type: 'text', text: 'Hello' }]
      });

      const result = SafeJSONParser.parseWithValidation(response, claudeSchema);
      expect(result).not.toBeNull();
      expect(result?.content[0].text).toBe('Hello');
    });

    it('should handle malformed API responses gracefully', () => {
      const schema = z.object({ data: z.array(z.any()) });

      // Missing closing brace
      const malformed = '{"data": [1, 2, 3]';

      const result = SafeJSONParser.parseWithValidation(malformed, schema, {
        fallback: { data: [] }
      });

      expect(result).toEqual({ data: [] });
    });

    it('should handle large JSON efficiently', () => {
      const largeData = { items: Array.from({ length: 1000 }, (_, i) => ({ id: i })) };
      const json = JSON.stringify(largeData);

      const start = Date.now();
      const result = SafeJSONParser.parse(json);
      const duration = Date.now() - start;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(100); // Should be fast
    });
  });
});
