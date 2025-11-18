# [MAJOR] MCP Server Sensitive Data Logging

## Labels
`major`, `security`, `mcp`, `privacy`, `pr-9`

## Priority
🟡 **MAJOR** - Security risk

## Description
MCP (Model Context Protocol) Server logs sensitive data in tool arguments without sanitization, creating a security and privacy risk similar to Issue #2 but specific to the MCP implementation.

## Current Behavior
```typescript
// MCP Server logs tool invocations with full arguments
logger.debug('MCP tool invoked', {
  tool: toolName,
  args: toolArguments // ❌ May contain sensitive data
});
```

## Expected Behavior
```typescript
// Sanitized logging
logger.debug('MCP tool invoked', {
  tool: toolName,
  args: sanitizeToolArgs(toolArguments) // ✅ PII redacted
});
```

## Impact
- **Severity:** HIGH
- **Security Risk:** Exposure of user credentials, API keys, personal data
- **Compliance:** GDPR/CCPA violation
- **Audit Trail:** Compromised security logs

## Relationship to Issue #2
This issue is **closely related** to Issue #2 (PII Exposure in Tool Argument Logging) and should use the **same sanitization solution**. The difference is the context (MCP Server vs general AI services).

## Files Affected
- `backend/services/mcp-server/src/tools/*` (all tool handlers)
- `backend/services/mcp-server/src/middleware/logging.ts`
- `backend/services/mcp-server/src/server.ts`

## Proposed Solution

### Reuse Sanitization from Issue #2
```typescript
// Import shared sanitization utility
import { sanitizeToolArgs } from '@shared/utils/sanitization';

// Apply to all MCP tool logging

// ❌ BEFORE
logger.debug('MCP tool invoked', {
  tool: toolName,
  args: toolArguments
});

// ✅ AFTER
logger.debug('MCP tool invoked', {
  tool: toolName,
  args: sanitizeToolArgs(toolArguments)
});
```

### MCP-Specific Enhancements
```typescript
// backend/services/mcp-server/src/middleware/mcp-logging.ts

import { sanitizeToolArgs, SanitizationConfig } from '@shared/utils/sanitization';

// MCP-specific sensitive fields
const MCP_SENSITIVE_FIELDS = [
  ...DEFAULT_SENSITIVE_FIELDS,
  'mcp_token',
  'client_secret',
  'model_api_key',
  'context_data',
  'user_context'
];

const MCP_SANITIZATION_CONFIG: Partial<SanitizationConfig> = {
  sensitiveFields: MCP_SENSITIVE_FIELDS,
  redactionText: '[MCP_REDACTED]'
};

export function sanitizeMCPToolArgs(args: any): any {
  return sanitizeToolArgs(args, MCP_SANITIZATION_CONFIG);
}

// Middleware for automatic sanitization
export function mcpLoggingMiddleware(
  req: MCPRequest,
  res: MCPResponse,
  next: NextFunction
): void {
  // Store original args
  const originalArgs = req.toolArgs;

  // Override with sanitized version for logging
  Object.defineProperty(req, 'safeToolArgs', {
    get: () => sanitizeMCPToolArgs(originalArgs)
  });

  next();
}
```

### Apply to All MCP Tools
```typescript
// backend/services/mcp-server/src/tools/base-tool.ts

export abstract class BaseMCPTool {
  protected logger: Logger;

  constructor(protected name: string) {
    this.logger = Logger.getInstance(`mcp-tool-${name}`);
  }

  async execute(args: any): Promise<any> {
    // ✅ Always log sanitized args
    this.logger.info('Tool execution started', {
      tool: this.name,
      args: sanitizeMCPToolArgs(args)
    });

    try {
      const result = await this.executeImpl(args);

      this.logger.info('Tool execution completed', {
        tool: this.name,
        success: true
      });

      return result;
    } catch (error) {
      this.logger.error('Tool execution failed', {
        tool: this.name,
        error: error.message,
        args: sanitizeMCPToolArgs(args) // ✅ Sanitized even in errors
      });

      throw error;
    }
  }

  protected abstract executeImpl(args: any): Promise<any>;
}
```

## Testing Requirements

### Unit Tests
```typescript
describe('MCP Logging Sanitization', () => {
  it('should sanitize MCP-specific sensitive fields', () => {
    const args = {
      mcp_token: 'secret-token-123',
      user_data: { email: 'user@example.com' },
      query: 'search term'
    };

    const sanitized = sanitizeMCPToolArgs(args);

    expect(sanitized.mcp_token).toBe('[MCP_REDACTED]');
    expect(sanitized.user_data.email).toBe('[MCP_REDACTED]');
    expect(sanitized.query).toBe('search term');
  });

  it('should sanitize nested context data', () => {
    const args = {
      context: {
        user_context: {
          apiKey: 'sk-1234567890',
          preferences: { theme: 'dark' }
        }
      }
    };

    const sanitized = sanitizeMCPToolArgs(args);

    expect(sanitized.context.user_context.apiKey).toBe('[MCP_REDACTED]');
    expect(sanitized.context.user_context.preferences.theme).toBe('dark');
  });
});

describe('BaseMCPTool', () => {
  class TestMCPTool extends BaseMCPTool {
    async executeImpl(args: any) {
      return { success: true };
    }
  }

  it('should log sanitized args on success', async () => {
    const tool = new TestMCPTool('test');
    const logSpy = jest.spyOn(tool['logger'], 'info');

    await tool.execute({
      apiKey: 'secret-key',
      query: 'test'
    });

    expect(logSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        args: expect.objectContaining({
          apiKey: '[MCP_REDACTED]',
          query: 'test'
        })
      })
    );
  });

  it('should log sanitized args on error', async () => {
    class FailingTool extends BaseMCPTool {
      async executeImpl(args: any) {
        throw new Error('Tool failed');
      }
    }

    const tool = new FailingTool('failing');
    const logSpy = jest.spyOn(tool['logger'], 'error');

    await expect(tool.execute({
      apiKey: 'secret-key',
      query: 'test'
    })).rejects.toThrow();

    expect(logSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        args: expect.objectContaining({
          apiKey: '[MCP_REDACTED]'
        })
      })
    );
  });
});
```

### Integration Tests
```typescript
describe('MCP Server Integration', () => {
  it('should never log sensitive data in production', async () => {
    const logCapture = new LogCapture();

    // Send request with sensitive data
    await mcpClient.invokeTool('test-tool', {
      email: 'user@example.com',
      apiKey: 'secret-key-123',
      query: 'test'
    });

    // Verify logs don't contain sensitive data
    const logs = logCapture.getLogs();

    expect(logs).not.toContainMatch(/user@example\.com/);
    expect(logs).not.toContainMatch(/secret-key-123/);
    expect(logs).toContainMatch(/test/); // Non-sensitive data OK
    expect(logs).toContainMatch(/\[MCP_REDACTED\]/);
  });
});
```

## Acceptance Criteria
- [ ] Apply sanitization to all MCP tool logging
- [ ] Add MCP-specific sensitive field configuration
- [ ] Create BaseMCPTool with built-in sanitization
- [ ] Update all existing MCP tools to extend BaseMCPTool
- [ ] Add comprehensive unit tests (100% coverage)
- [ ] Add integration tests for log sanitization
- [ ] Audit existing MCP logs for exposed data
- [ ] Update MCP server documentation
- [ ] Security team review and approval

## Rollout Plan
1. **Phase 1:** Implement BaseMCPTool with sanitization
2. **Phase 2:** Migrate existing tools to BaseMCPTool
3. **Phase 3:** Deploy to staging and audit logs
4. **Phase 4:** Security review
5. **Phase 5:** Deploy to production

## Dependencies
- **Requires:** Issue #2 sanitization utility implementation
- **Blocks:** MCP Server production deployment
- **Related:** All MCP tool implementations

## Estimated Effort
2 hours (assuming Issue #2 sanitization utility is complete)

## Related Issues
- Issue #2: CRITICAL - PII Exposure in Tool Argument Logging
- PR #9: Repository analysis

## References
- Model Context Protocol Specification
- OWASP Logging Cheat Sheet
- GDPR Article 32 (Security of processing)
