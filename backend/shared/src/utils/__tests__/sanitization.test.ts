/**
 * PII Sanitization Utilities - Test Suite
 *
 * Comprehensive tests for sanitization functionality
 * @see Issue #2: CRITICAL - PII Exposure in Tool Argument Logging
 */

import {
  sanitizeToolArgs,
  detectPII,
  redactPIIFromString,
  createSanitizer,
  sanitizeBatch,
  DEFAULT_SENSITIVE_FIELDS
} from '../sanitization';

describe('PII Sanitization Utils', () => {
  describe('sanitizeToolArgs', () => {
    it('should redact sensitive field names', () => {
      const input = {
        email: 'user@example.com',
        password: 'secret123',
        name: 'John Doe',
        age: 30
      };

      const result = sanitizeToolArgs(input);

      expect(result.email).toBe('[REDACTED]');
      expect(result.password).toBe('[REDACTED]');
      expect(result.name).toBe('John Doe');
      expect(result.age).toBe(30);
    });

    it('should handle nested objects', () => {
      const input = {
        user: {
          email: 'user@example.com',
          profile: {
            username: 'johndoe',
            api_key: 'sk-123456'
          }
        },
        query: 'search term'
      };

      const result = sanitizeToolArgs(input);

      expect(result.user.email).toBe('[REDACTED]');
      expect(result.user.profile.username).toBe('[REDACTED]');
      expect(result.user.profile.api_key).toBe('[REDACTED]');
      expect(result.query).toBe('search term');
    });

    it('should handle arrays', () => {
      const input = {
        users: [
          { email: 'user1@example.com', name: 'User 1' },
          { email: 'user2@example.com', name: 'User 2' }
        ]
      };

      const result = sanitizeToolArgs(input);

      expect(result.users[0].email).toBe('[REDACTED]');
      expect(result.users[0].name).toBe('User 1');
      expect(result.users[1].email).toBe('[REDACTED]');
      expect(result.users[1].name).toBe('User 2');
    });

    it('should handle circular references', () => {
      const input: any = { name: 'test' };
      input.self = input;

      const result = sanitizeToolArgs(input);

      expect(result.name).toBe('test');
      expect(result.self).toBe('[CIRCULAR_REFERENCE]');
    });

    it('should respect max depth', () => {
      const deep = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  level6: {
                    data: 'too deep'
                  }
                }
              }
            }
          }
        }
      };

      const result = sanitizeToolArgs(deep, { maxDepth: 5 });

      expect(result.level1.level2.level3.level4.level5).toBe('[MAX_DEPTH_EXCEEDED]');
    });

    it('should handle null and undefined', () => {
      const input = {
        nullValue: null,
        undefinedValue: undefined,
        email: 'user@example.com'
      };

      const result = sanitizeToolArgs(input);

      expect(result.nullValue).toBeNull();
      expect(result.undefinedValue).toBeUndefined();
      expect(result.email).toBe('[REDACTED]');
    });

    it('should handle primitives', () => {
      expect(sanitizeToolArgs('string')).toBe('string');
      expect(sanitizeToolArgs(123)).toBe(123);
      expect(sanitizeToolArgs(true)).toBe(true);
      expect(sanitizeToolArgs(false)).toBe(false);
    });

    it('should use custom redaction text', () => {
      const input = { password: 'secret' };
      const result = sanitizeToolArgs(input, { redactionText: '[HIDDEN]' });

      expect(result.password).toBe('[HIDDEN]');
    });

    it('should use custom sensitive fields', () => {
      const input = {
        customSecret: 'secret data',
        email: 'user@example.com',
        public: 'public data'
      };

      const result = sanitizeToolArgs(input, {
        sensitiveFields: ['customSecret']
      });

      expect(result.customSecret).toBe('[REDACTED]');
      expect(result.email).toBe('user@example.com'); // Not in custom list
      expect(result.public).toBe('public data');
    });

    it('should handle case-insensitive field matching', () => {
      const input = {
        EMAIL: 'user@example.com',
        Password: 'secret',
        API_KEY: 'key123'
      };

      const result = sanitizeToolArgs(input);

      expect(result.EMAIL).toBe('[REDACTED]');
      expect(result.Password).toBe('[REDACTED]');
      expect(result.API_KEY).toBe('[REDACTED]');
    });
  });

  describe('detectPII', () => {
    it('should detect email addresses', () => {
      expect(detectPII('Contact us at user@example.com')).toBe(true);
      expect(detectPII('No email here')).toBe(false);
    });

    it('should detect phone numbers', () => {
      expect(detectPII('Call 555-123-4567')).toBe(true);
      expect(detectPII('Call (555) 123-4567')).toBe(true);
      expect(detectPII('+1-555-123-4567')).toBe(true);
      expect(detectPII('No phone here')).toBe(false);
    });

    it('should detect SSN', () => {
      expect(detectPII('SSN: 123-45-6789')).toBe(true);
      expect(detectPII('No SSN here')).toBe(false);
    });

    it('should detect credit card numbers', () => {
      expect(detectPII('Card: 1234 5678 9012 3456')).toBe(true);
      expect(detectPII('Card: 1234567890123456')).toBe(true);
      expect(detectPII('No card here')).toBe(false);
    });

    it('should detect IP addresses', () => {
      expect(detectPII('IP: 192.168.1.1')).toBe(true);
      expect(detectPII('Server: 10.0.0.1')).toBe(true);
      expect(detectPII('No IP here')).toBe(false);
    });

    it('should detect JWT tokens', () => {
      const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature';
      expect(detectPII(`Token: ${jwt}`)).toBe(true);
      expect(detectPII('No token here')).toBe(false);
    });

    it('should return false for non-string values', () => {
      expect(detectPII(123 as any)).toBe(false);
      expect(detectPII(null as any)).toBe(false);
      expect(detectPII(undefined as any)).toBe(false);
    });
  });

  describe('redactPIIFromString', () => {
    it('should redact emails from strings', () => {
      const text = 'Contact user@example.com or admin@example.com';
      const result = redactPIIFromString(text);

      expect(result).toBe('Contact [REDACTED] or [REDACTED]');
    });

    it('should redact phone numbers from strings', () => {
      const text = 'Call 555-123-4567 or (555) 987-6543';
      const result = redactPIIFromString(text);

      expect(result).toContain('[REDACTED]');
      expect(result).not.toContain('555-123-4567');
    });

    it('should redact SSN from strings', () => {
      const text = 'SSN: 123-45-6789';
      const result = redactPIIFromString(text);

      expect(result).toBe('SSN: [REDACTED]');
    });

    it('should redact credit cards from strings', () => {
      const text = 'Card: 1234 5678 9012 3456';
      const result = redactPIIFromString(text);

      expect(result).toBe('Card: [REDACTED]');
    });

    it('should redact IP addresses from strings', () => {
      const text = 'Server: 192.168.1.1';
      const result = redactPIIFromString(text);

      expect(result).toBe('Server: [REDACTED]');
    });

    it('should use custom redaction text', () => {
      const text = 'Email: user@example.com';
      const result = redactPIIFromString(text, '[HIDDEN]');

      expect(result).toBe('Email: [HIDDEN]');
    });

    it('should preserve non-PII content', () => {
      const text = 'This is a normal message without PII';
      const result = redactPIIFromString(text);

      expect(result).toBe(text);
    });

    it('should handle multiple PII types in one string', () => {
      const text = 'Contact user@example.com at 555-123-4567 or visit 192.168.1.1';
      const result = redactPIIFromString(text);

      expect(result).toContain('[REDACTED]');
      expect(result).not.toContain('user@example.com');
      expect(result).not.toContain('555-123-4567');
      expect(result).not.toContain('192.168.1.1');
    });
  });

  describe('createSanitizer', () => {
    it('should create a custom sanitizer function', () => {
      const sanitizer = createSanitizer({
        sensitiveFields: ['custom_field'],
        redactionText: '[CUSTOM]'
      });

      const input = {
        custom_field: 'secret',
        email: 'user@example.com',
        public: 'data'
      };

      const result = sanitizer(input);

      expect(result.custom_field).toBe('[CUSTOM]');
      expect(result.email).toBe('user@example.com'); // Not in custom list
    });

    it('should be reusable', () => {
      const sanitizer = createSanitizer({ redactionText: '[MASKED]' });

      const result1 = sanitizer({ password: 'secret1' });
      const result2 = sanitizer({ password: 'secret2' });

      expect(result1.password).toBe('[MASKED]');
      expect(result2.password).toBe('[MASKED]');
    });
  });

  describe('sanitizeBatch', () => {
    it('should sanitize multiple items', () => {
      const items = [
        { email: 'user1@example.com', name: 'User 1' },
        { email: 'user2@example.com', name: 'User 2' },
        { email: 'user3@example.com', name: 'User 3' }
      ];

      const results = sanitizeBatch(items);

      expect(results).toHaveLength(3);
      expect(results[0].email).toBe('[REDACTED]');
      expect(results[0].name).toBe('User 1');
      expect(results[1].email).toBe('[REDACTED]');
      expect(results[2].email).toBe('[REDACTED]');
    });

    it('should use custom configuration', () => {
      const items = [
        { password: 'secret1' },
        { password: 'secret2' }
      ];

      const results = sanitizeBatch(items, { redactionText: '[HIDDEN]' });

      expect(results[0].password).toBe('[HIDDEN]');
      expect(results[1].password).toBe('[HIDDEN]');
    });

    it('should handle empty arrays', () => {
      const results = sanitizeBatch([]);
      expect(results).toEqual([]);
    });
  });

  describe('DEFAULT_SENSITIVE_FIELDS', () => {
    it('should include common authentication fields', () => {
      expect(DEFAULT_SENSITIVE_FIELDS).toContain('password');
      expect(DEFAULT_SENSITIVE_FIELDS).toContain('api_key');
      expect(DEFAULT_SENSITIVE_FIELDS).toContain('token');
      expect(DEFAULT_SENSITIVE_FIELDS).toContain('secret');
    });

    it('should include personal information fields', () => {
      expect(DEFAULT_SENSITIVE_FIELDS).toContain('email');
      expect(DEFAULT_SENSITIVE_FIELDS).toContain('phone');
      expect(DEFAULT_SENSITIVE_FIELDS).toContain('ssn');
      expect(DEFAULT_SENSITIVE_FIELDS).toContain('credit_card');
    });

    it('should include identifier fields', () => {
      expect(DEFAULT_SENSITIVE_FIELDS).toContain('user_id');
      expect(DEFAULT_SENSITIVE_FIELDS).toContain('ip_address');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty objects', () => {
      const result = sanitizeToolArgs({});
      expect(result).toEqual({});
    });

    it('should handle very large objects', () => {
      const large: any = {};
      for (let i = 0; i < 1000; i++) {
        large[`field${i}`] = `value${i}`;
      }
      large.email = 'user@example.com';

      const result = sanitizeToolArgs(large);

      expect(result.email).toBe('[REDACTED]');
      expect(result.field0).toBe('value0');
      expect(Object.keys(result)).toHaveLength(1001);
    });

    it('should handle special characters in field names', () => {
      const input = {
        'user-email': 'user@example.com',
        'api_key_123': 'secret',
        'data[0]': 'value'
      };

      const result = sanitizeToolArgs(input);

      expect(result['user-email']).toBe('[REDACTED]');
      expect(result['api_key_123']).toBe('[REDACTED]');
      expect(result['data[0]']).toBe('value');
    });

    it('should handle numeric field names', () => {
      const input = {
        0: 'value0',
        1: { email: 'user@example.com' }
      };

      const result = sanitizeToolArgs(input);

      expect(result[0]).toBe('value0');
      expect(result[1].email).toBe('[REDACTED]');
    });
  });

  describe('Performance', () => {
    it('should handle deeply nested objects efficiently', () => {
      let deep: any = { value: 'data' };
      for (let i = 0; i < 10; i++) {
        deep = { nested: deep, email: 'user@example.com' };
      }

      const start = Date.now();
      const result = sanitizeToolArgs(deep);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100); // Should complete in <100ms
      expect(result.email).toBe('[REDACTED]');
    });
  });
});
