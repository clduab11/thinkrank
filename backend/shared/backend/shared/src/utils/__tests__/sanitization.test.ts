/**
 * Comprehensive test suite for sanitization utilities
 * Ensures PII protection and GDPR/CCPA compliance
 *
 * @see backend/shared/src/utils/sanitization.ts
 */

import {
  sanitizeToolArgs,
  detectPII,
  sanitizeString,
  createSanitizationConfig,
  sanitizeError,
  DEFAULT_CONFIG
} from '../sanitization';

describe('Sanitization Utils', () => {
  describe('sanitizeToolArgs', () => {
    it('should redact email addresses', () => {
      const input = { email: 'user@example.com', name: 'John' };
      const output = sanitizeToolArgs(input);

      expect(output.email).toBe('[REDACTED]');
      expect(output.name).toBe('John');
    });

    it('should redact nested sensitive fields', () => {
      const input = {
        user: {
          email: 'user@example.com',
          profile: {
            apiKey: 'secret-key-123',
            preferences: { theme: 'dark' }
          }
        }
      };

      const output = sanitizeToolArgs(input);

      expect(output.user.email).toBe('[REDACTED]');
      expect(output.user.profile.apiKey).toBe('[REDACTED]');
      expect(output.user.profile.preferences.theme).toBe('dark');
    });

    it('should handle arrays of objects', () => {
      const input = {
        users: [
          { email: 'user1@example.com', name: 'Alice' },
          { email: 'user2@example.com', name: 'Bob' }
        ]
      };

      const output = sanitizeToolArgs(input);

      expect(output.users[0].email).toBe('[REDACTED]');
      expect(output.users[0].name).toBe('Alice');
      expect(output.users[1].email).toBe('[REDACTED]');
      expect(output.users[1].name).toBe('Bob');
    });

    it('should redact authentication tokens', () => {
      const input = {
        accessToken: 'jwt-token-123',
        refreshToken: 'refresh-456',
        data: { value: 'public' }
      };

      const output = sanitizeToolArgs(input);

      expect(output.accessToken).toBe('[REDACTED]');
      expect(output.refreshToken).toBe('[REDACTED]');
      expect(output.data.value).toBe('public');
    });

    it('should handle null and undefined values', () => {
      const input = { value: null, optional: undefined, name: 'test' };
      const output = sanitizeToolArgs(input);

      expect(output.value).toBeNull();
      expect(output.optional).toBeUndefined();
      expect(output.name).toBe('test');
    });

    it('should prevent infinite recursion with max depth', () => {
      const input = { level1: { level2: { level3: { level4: { level5: { level6: 'deep' } } } } } };
      const output = sanitizeToolArgs(input);

      // Should stop at maxDepth (default 5)
      expect(output.level1.level2.level3.level4.level5.level6).toBe('[MAX_DEPTH_EXCEEDED]');
    });

    it('should handle circular references gracefully', () => {
      const input: any = { name: 'test' };
      input.self = input; // Circular reference

      // Should not throw and handle gracefully
      expect(() => sanitizeToolArgs(input)).not.toThrow();
    });

    it('should handle primitive values', () => {
      expect(sanitizeToolArgs('string')).toBe('string');
      expect(sanitizeToolArgs(123)).toBe(123);
      expect(sanitizeToolArgs(true)).toBe(true);
      expect(sanitizeToolArgs(null)).toBeNull();
    });

    it('should use custom configuration', () => {
      const input = { customField: 'secret', normalField: 'public' };
      const config = {
        sensitiveFields: ['customField'],
        redactionText: '[CUSTOM_REDACTED]'
      };

      const output = sanitizeToolArgs(input, config);

      expect(output.customField).toBe('[CUSTOM_REDACTED]');
      expect(output.normalField).toBe('public');
    });

    it('should handle case-insensitive field matching', () => {
      const input = {
        EMAIL: 'upper@example.com',
        Email: 'mixed@example.com',
        email: 'lower@example.com'
      };

      const output = sanitizeToolArgs(input);

      expect(output.EMAIL).toBe('[REDACTED]');
      expect(output.Email).toBe('[REDACTED]');
      expect(output.email).toBe('[REDACTED]');
    });

    it('should handle Date objects', () => {
      const date = new Date('2024-01-01');
      const input = { timestamp: date, name: 'test' };

      const output = sanitizeToolArgs(input);

      expect(output.timestamp).toEqual(date);
      expect(output.name).toBe('test');
    });
  });

  describe('detectPII', () => {
    it('should detect email addresses', () => {
      expect(detectPII('Contact: user@example.com')).toBe(true);
      expect(detectPII('Email me at john.doe@company.org')).toBe(true);
    });

    it('should detect phone numbers', () => {
      expect(detectPII('Call: 555-123-4567')).toBe(true);
      expect(detectPII('Phone: (555) 123-4567')).toBe(true);
      expect(detectPII('+1-555-123-4567')).toBe(true);
    });

    it('should detect SSN', () => {
      expect(detectPII('SSN: 123-45-6789')).toBe(true);
    });

    it('should detect credit card numbers', () => {
      expect(detectPII('Card: 1234 5678 9012 3456')).toBe(true);
      expect(detectPII('CC: 1234-5678-9012-3456')).toBe(true);
    });

    it('should detect JWT tokens', () => {
      const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      expect(detectPII(jwt)).toBe(true);
    });

    it('should return false for clean text', () => {
      expect(detectPII('This is clean text')).toBe(false);
      expect(detectPII('No sensitive information here')).toBe(false);
    });

    it('should detect IP addresses', () => {
      expect(detectPII('IP: 192.168.1.1')).toBe(true);
      expect(detectPII('Server at 10.0.0.1')).toBe(true);
    });
  });

  describe('sanitizeString', () => {
    it('should redact emails in text', () => {
      const input = 'Contact us at support@example.com or sales@example.org';
      const output = sanitizeString(input);

      expect(output).not.toContain('support@example.com');
      expect(output).not.toContain('sales@example.org');
      expect(output).toContain('[EMAIL_REDACTED]');
    });

    it('should redact phone numbers in text', () => {
      const input = 'Call 555-123-4567 or (555) 987-6543';
      const output = sanitizeString(input);

      expect(output).not.toContain('555-123-4567');
      expect(output).toContain('[PHONE_REDACTED]');
    });

    it('should redact multiple PII types', () => {
      const input = 'Email: user@test.com, Phone: 555-1234, SSN: 123-45-6789';
      const output = sanitizeString(input);

      expect(output).toContain('[EMAIL_REDACTED]');
      expect(output).toContain('[PHONE_REDACTED]');
      expect(output).toContain('[SSN_REDACTED]');
      expect(output).not.toContain('user@test.com');
      expect(output).not.toContain('123-45-6789');
    });

    it('should preserve non-PII content', () => {
      const input = 'Hello, this is a message with user@test.com embedded';
      const output = sanitizeString(input);

      expect(output).toContain('Hello');
      expect(output).toContain('this is a message');
      expect(output).not.toContain('user@test.com');
    });
  });

  describe('createSanitizationConfig', () => {
    it('should create config with additional fields', () => {
      const config = createSanitizationConfig(['customSecret', 'internalId']);

      expect(config.sensitiveFields).toContain('customSecret');
      expect(config.sensitiveFields).toContain('internalId');
      expect(config.sensitiveFields).toContain('email'); // Default fields still included
    });

    it('should allow custom redaction text', () => {
      const config = createSanitizationConfig([], '[HIDDEN]');

      expect(config.redactionText).toBe('[HIDDEN]');
    });
  });

  describe('sanitizeError', () => {
    it('should sanitize Error objects', () => {
      const error = new Error('Database error: user@example.com not found');
      const sanitized = sanitizeError(error);

      expect(sanitized.name).toBe('Error');
      expect(sanitized.message).not.toContain('user@example.com');
      expect(sanitized.message).toContain('[EMAIL_REDACTED]');
    });

    it('should sanitize error-like objects', () => {
      const error = {
        code: 'AUTH_FAILED',
        email: 'user@example.com',
        token: 'secret-token'
      };

      const sanitized = sanitizeError(error);

      expect(sanitized.code).toBe('AUTH_FAILED');
      expect(sanitized.email).toBe('[REDACTED]');
      expect(sanitized.token).toBe('[REDACTED]');
    });

    it('should remove stack traces in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Test error');
      const sanitized = sanitizeError(error);

      expect(sanitized.stack).toBeUndefined();

      process.env.NODE_ENV = originalEnv;
    });

    it('should include stack traces in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new Error('Test error');
      const sanitized = sanitizeError(error);

      expect(sanitized.stack).toBeDefined();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Integration: Real-world scenarios', () => {
    it('should handle complex authentication payload', () => {
      const payload = {
        username: 'john_doe',
        password: 'super-secret-123',
        email: 'john@example.com',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        metadata: {
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          sessionId: 'abc123'
        }
      };

      const sanitized = sanitizeToolArgs(payload);

      expect(sanitized.username).toBe('john_doe');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.email).toBe('[REDACTED]');
      expect(sanitized.token).toBe('[REDACTED]');
      expect(sanitized.metadata.userAgent).toBe('Mozilla/5.0');
      expect(sanitized.metadata.sessionId).toBe('[REDACTED]');
    });

    it('should handle payment information', () => {
      const payment = {
        amount: 99.99,
        currency: 'USD',
        creditCard: '1234-5678-9012-3456',
        cvv: '123',
        billingAddress: '123 Main St'
      };

      const sanitized = sanitizeToolArgs(payment);

      expect(sanitized.amount).toBe(99.99);
      expect(sanitized.currency).toBe('USD');
      expect(sanitized.creditCard).toBe('[REDACTED]');
      expect(sanitized.cvv).toBe('[REDACTED]');
      expect(sanitized.billingAddress).toBe('[REDACTED]');
    });

    it('should handle API request logs', () => {
      const apiLog = {
        method: 'POST',
        path: '/api/users',
        headers: {
          authorization: 'Bearer eyJhbGci...',
          'content-type': 'application/json'
        },
        body: {
          email: 'newuser@example.com',
          password: 'password123'
        }
      };

      const sanitized = sanitizeToolArgs(apiLog);

      expect(sanitized.method).toBe('POST');
      expect(sanitized.path).toBe('/api/users');
      expect(sanitized.headers.authorization).toBe('[REDACTED]');
      expect(sanitized.headers['content-type']).toBe('application/json');
      expect(sanitized.body.email).toBe('[REDACTED]');
      expect(sanitized.body.password).toBe('[REDACTED]');
    });
  });

  describe('Performance', () => {
    it('should handle large objects efficiently', () => {
      const largeObject: any = {};
      for (let i = 0; i < 1000; i++) {
        largeObject[`field${i}`] = i % 2 === 0 ? `value${i}` : `email${i}@example.com`;
      }

      const start = Date.now();
      const sanitized = sanitizeToolArgs(largeObject);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100); // Should complete in <100ms
      expect(Object.keys(sanitized).length).toBe(1000);
    });

    it('should handle deeply nested structures', () => {
      let deep: any = { value: 'test' };
      for (let i = 0; i < 10; i++) {
        deep = { nested: deep };
      }

      expect(() => sanitizeToolArgs(deep)).not.toThrow();
    });
  });
});
