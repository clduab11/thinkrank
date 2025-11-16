# GitHub Copilot System Prompt for ThinkRank

## 📋 Copy This Prompt to Copilot Settings

**Location:**
- GitHub Copilot Chat → Settings → Custom Instructions
- Cursor → Settings → Rules for AI
- VS Code → Create `.github/copilot-instructions.md`

---

## 🤖 ThinkRank AI Development Context (1000 characters)

```
You are developing ThinkRank, a production-grade AI literacy gaming platform at 68% completion targeting 100%. ARCHITECTURE: Microservices (11 services: auth, game, ai-domain, ai-research, social, analytics, realtime, api-gateway, compliance, mobile-optimization, shared). Stack: TypeScript, Node.js, PostgreSQL, Redis, Unity (C#), Kubernetes, Istio. TESTING: Follow London School TDD patterns (see backend/services/auth-service/__tests__ and testing/examples/). Generate comprehensive mocks, test doubles, and interaction verifications. Target 80%+ coverage. SECURITY: Implement RS256 JWT, bcrypt (12 rounds), GDPR compliance, encrypted databases, rate limiting. Never hardcode secrets. PERFORMANCE: Target <150ms API response (p95), 60fps mobile, <5MB bundles. Use SQL window functions for aggregations, Redis caching (85%+ hit rate), SCAN not KEYS. CODE QUALITY: Max 500 lines/file, comprehensive JSDoc, no console.log (use Logger), eliminate 'any' types, structured error handling. PATTERNS: DDD aggregates, event sourcing, circuit breakers, dependency injection. Follow existing patterns in codebase. PRIORITIES: Security > Performance > Testing > Documentation. November 2025 standards apply.
```

---

## 📖 Detailed Context (For Reference)

### Architecture Patterns
**When generating code, follow these patterns:**

1. **Microservices Communication:**
   ```typescript
   // Use dependency injection
   export class ServiceName {
     constructor(
       private readonly dependency: DependencyInterface
     ) {}
   }
   ```

2. **Error Handling:**
   ```typescript
   // Use custom error classes
   throw new ValidationError('Message', { context });
   // Never: throw new Error('Message')
   ```

3. **Logging:**
   ```typescript
   // Use structured logger
   logger.info('Action completed', { userId, metadata });
   // Never: console.log()
   ```

4. **Database Queries:**
   ```typescript
   // Use SQL window functions for aggregations
   WITH ranked AS (
     SELECT *, RANK() OVER (ORDER BY score DESC) as rank
     FROM table
   )
   SELECT * FROM ranked WHERE user_id = ?;
   // Never: Fetch all, aggregate in memory
   ```

### Testing Standards (London School TDD)
**Generate tests following this pattern:**

```typescript
describe('ServiceName', () => {
  let service: ServiceName;
  let mockDependency: jest.Mocked<DependencyInterface>;

  beforeEach(() => {
    mockDependency = {
      method: jest.fn()
    } as any;
    service = new ServiceName(mockDependency);
  });

  describe('methodName', () => {
    it('should perform expected behavior', async () => {
      // Arrange
      const input = { data: 'test' };
      mockDependency.method.mockResolvedValue('result');

      // Act
      const result = await service.methodName(input);

      // Assert
      expect(mockDependency.method).toHaveBeenCalledWith(expectedArgs);
      expect(result).toBe('result');
    });

    it('should handle errors appropriately', async () => {
      // Test error scenarios
    });
  });
});
```

### Security Requirements
**All generated code must include:**

- JWT validation with RS256
- Bcrypt password hashing (12 salt rounds)
- Input validation and sanitization
- Rate limiting on sensitive endpoints
- Audit logging for security events
- No secrets in code (use environment variables)
- SQL parameterization (prevent injection)
- CSRF protection on state-changing operations

### Performance Standards
**Optimize all generated code for:**

- API responses <150ms (p95)
- Database queries with proper indexes
- Redis caching where appropriate
- Compression for large payloads
- Efficient algorithms (avoid N+1 queries)
- Lazy loading and code splitting (frontend)

### Code Quality Standards
**All generated code must:**

- Include comprehensive JSDoc comments
- Use TypeScript strict mode
- Have proper type definitions (no `any`)
- Follow single responsibility principle
- Be under 500 lines per file
- Include error handling
- Use structured logging
- Have 70%+ test coverage

### File Organization
**When creating new files:**

```
backend/services/[service-name]/
├── src/
│   ├── controllers/     # HTTP request handlers
│   ├── services/        # Business logic
│   ├── repositories/    # Data access
│   ├── middleware/      # Express middleware
│   ├── routes/          # Route definitions
│   ├── types/           # TypeScript types
│   ├── config/          # Configuration
│   └── __tests__/       # Tests (mirror src structure)
│       ├── unit/
│       ├── integration/
│       └── setup.ts
├── jest.config.js
├── tsconfig.json
└── package.json
```

---

## 🎯 AI Code Generation Guidelines

### DO:
- ✅ Generate complete implementations from issue examples
- ✅ Follow existing patterns in the codebase
- ✅ Write tests BEFORE implementation (TDD)
- ✅ Include comprehensive JSDoc
- ✅ Use proper TypeScript types
- ✅ Implement security best practices
- ✅ Optimize for performance
- ✅ Handle all error cases

### DON'T:
- ❌ Use `any` type (use proper types or `unknown`)
- ❌ Use `console.log` (use Logger)
- ❌ Hardcode secrets or credentials
- ❌ Create files over 500 lines
- ❌ Forget error handling
- ❌ Skip input validation
- ❌ Use blocking Redis operations (`keys()`)
- ❌ Aggregate data in memory (use SQL)

---

## 📚 Reference Examples in Codebase

**When generating similar code, reference these:**

### Excellent Test Example:
`backend/services/ai-domain-service/src/__tests__/tdd/unified-ai-service.test.ts`
- Perfect London School TDD pattern
- Comprehensive mocking
- Test builders and helpers

### Excellent Service Example:
`backend/services/auth-service/src/services/authentication.service.ts`
- Proper security implementation
- Good error handling
- Clean architecture

### Excellent Middleware Example:
`backend/services/auth-service/src/middleware/auth.middleware.ts`
- JWT validation
- Error handling
- Request context

---

## 🔄 Prompt Version

**Version:** 2.0
**Last Updated:** 2025-11-15
**Context Length:** 1000 characters (optimized)
**Full Context:** Available in this document for reference

---

## 💡 Usage Tips

1. **For new features:** Reference issue examples and existing patterns
2. **For tests:** Follow London School TDD pattern from examples
3. **For security:** Always implement validation, rate limiting, audit logging
4. **For performance:** Use SQL aggregations, caching, proper indexes
5. **For documentation:** Generate JSDoc with @param, @returns, @throws, @example

---

**This prompt gives AI context about your architecture, patterns, and standards to generate better code aligned with November 2025 best practices.**
