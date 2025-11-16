# [CRITICAL] Security: PII Exposure in Tool Argument Logging

## Labels
`critical`, `security`, `compliance`, `gdpr`, `privacy`, `pr-9`

## Priority
🔴 **CRITICAL** - Security vulnerability

## Description
Full tool arguments are being logged without sanitization, potentially exposing Personally Identifiable Information (PII) and violating GDPR/CCPA compliance requirements.

## Security Impact
- **Severity:** HIGH
- **CVSS Score:** 7.5 (High)
- **Compliance Risk:** GDPR/CCPA violation
- **Data at Risk:**
  - User emails
  - Personal identifiers
  - API keys
  - Session tokens
  - Authentication credentials

## Current Behavior
```typescript
// Logging full arguments without sanitization
logger.info('Tool invoked', { args: fullArgs });
logger.debug('Processing request', { userInput: sensitiveData });
```

## Expected Behavior
```typescript
// Sanitized logging with PII redaction
logger.info('Tool invoked', { args: sanitizeToolArgs(fullArgs) });
logger.debug('Processing request', { userInput: sanitizeToolArgs(sensitiveData) });
```

## Files Affected
- `backend/services/ai-service/src/tools/*` (all tool implementations)
- `backend/services/mcp-server/src/*` (MCP server logging)
- `backend/services/auth-service/src/*` (authentication flows)
- Any service with user input logging

## Proposed Solution

### 1. Create Centralized Sanitization Utility
```typescript
// backend/shared/src/utils/sanitization.ts

interface SanitizationConfig {
  sensitiveFields: string[];
  redactionText: string;
  maxDepth: number;
}

const DEFAULT_CONFIG: SanitizationConfig = {
  sensitiveFields: [
    'email', 'password', 'token', 'apiKey', 'api_key',
    'secret', 'ssn', 'phone', 'address', 'credit_card',
    'authorization', 'cookie', 'session', 'jwt'
  ],
  redactionText: '[REDACTED]',
  maxDepth: 5
};

export function sanitizeToolArgs(
  args: any,
  config: Partial<SanitizationConfig> = {}
): any {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  return sanitizeObject(args, finalConfig, 0);
}

function sanitizeObject(
  obj: any,
  config: SanitizationConfig,
  depth: number
): any {
  if (depth > config.maxDepth) return '[MAX_DEPTH_EXCEEDED]';
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, config, depth + 1));
  }

  return Object.entries(obj).reduce((acc, [key, value]) => {
    // Check if field is sensitive
    const isSensitive = config.sensitiveFields.some(
      field => key.toLowerCase().includes(field.toLowerCase())
    );

    if (isSensitive) {
      acc[key] = config.redactionText;
    } else if (typeof value === 'object') {
      acc[key] = sanitizeObject(value, config, depth + 1);
    } else {
      acc[key] = value;
    }

    return acc;
  }, {} as any);
}

// PII detection with regex patterns
export function detectPII(text: string): boolean {
  const patterns = {
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
    phone: /(\+\d{1,3}[- ]?)?\d{10}/,
    ssn: /\d{3}-\d{2}-\d{4}/,
    creditCard: /\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}/
  };

  return Object.values(patterns).some(pattern => pattern.test(text));
}
```

### 2. Update All Logging Statements
```typescript
// Import sanitization utility
import { sanitizeToolArgs } from '@shared/utils/sanitization';

// ❌ BEFORE
logger.info('Tool invoked', { tool, args });

// ✅ AFTER
logger.info('Tool invoked', {
  tool,
  args: sanitizeToolArgs(args)
});
```

### 3. Add Automated PII Detection Tests
```typescript
// backend/shared/src/utils/__tests__/sanitization.test.ts

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
          profile: { apiKey: 'secret-key' }
        }
      };
      const output = sanitizeToolArgs(input);
      expect(output.user.email).toBe('[REDACTED]');
      expect(output.user.profile.apiKey).toBe('[REDACTED]');
    });

    it('should handle arrays', () => {
      const input = {
        users: [
          { email: 'user1@example.com' },
          { email: 'user2@example.com' }
        ]
      };
      const output = sanitizeToolArgs(input);
      expect(output.users[0].email).toBe('[REDACTED]');
      expect(output.users[1].email).toBe('[REDACTED]');
    });
  });

  describe('detectPII', () => {
    it('should detect email addresses', () => {
      expect(detectPII('Contact: user@example.com')).toBe(true);
    });

    it('should detect phone numbers', () => {
      expect(detectPII('Call: 555-123-4567')).toBe(true);
    });

    it('should return false for clean text', () => {
      expect(detectPII('This is clean text')).toBe(false);
    });
  });
});
```

## Acceptance Criteria
- [ ] Implement centralized argument sanitization utility
- [ ] Audit all logging statements across all services
- [ ] Replace unsanitized logging with sanitized version
- [ ] Add PII detection regex patterns
- [ ] Add unit tests for sanitization (100% coverage)
- [ ] Add integration tests for logging
- [ ] Update logging documentation and guidelines
- [ ] Add pre-commit hook to detect unsanitized logging
- [ ] Configure log aggregation to redact PII
- [ ] Security team review and approval

## Testing Requirements
1. **Unit Tests:**
   - Sanitization of various data types
   - Nested object sanitization
   - Array sanitization
   - Edge cases (null, undefined, circular references)

2. **Integration Tests:**
   - End-to-end logging with real tool invocations
   - Log aggregation pipeline testing
   - PII detection accuracy

3. **Security Tests:**
   - Penetration testing for PII exposure
   - Log file analysis for leaked data
   - Compliance validation (GDPR/CCPA)

## Compliance Checklist
- [ ] GDPR Article 32 (Security of processing)
- [ ] GDPR Article 25 (Data protection by design)
- [ ] CCPA Section 1798.150 (Security measures)
- [ ] PCI DSS Requirement 3.4 (Render PAN unreadable)

## Rollout Plan
1. **Phase 1:** Implement sanitization utility
2. **Phase 2:** Update critical services (auth, payment)
3. **Phase 3:** Update all other services
4. **Phase 4:** Add automated detection
5. **Phase 5:** Security audit and sign-off

## Estimated Effort
4 hours (development) + 2 hours (security review)

## Related Issues
- PR #9: Repository analysis
- Issue #6: MCP Server sensitive logging
- Security audit findings

## References
- GDPR Compliance: https://gdpr.eu/
- OWASP Logging Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
- NIST SP 800-53 (AU-9): Protection of Audit Information
