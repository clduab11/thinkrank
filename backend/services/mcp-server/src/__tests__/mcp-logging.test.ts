/**
 * MCP Logging Sanitization - Test Suite
 *
 * Tests for MCP-specific logging sanitization
 * @see Issue #6: MAJOR - MCP Server Sensitive Data Logging
 */

import {
  sanitizeMCPToolArgs,
  sanitizeMCPResponse,
  MCP_SENSITIVE_FIELDS,
  MCP_SANITIZATION_CONFIG,
  mcpLoggingMiddleware,
  createLoggingContext,
  logToolInvocation,
  logToolCompletion,
  logToolError,
  MCPRequest,
  MCPResponse
} from '../middleware/mcp-logging';

describe('MCP Logging Sanitization', () => {
  describe('sanitizeMCPToolArgs', () => {
    it('should sanitize standard sensitive fields', () => {
      const args = {
        email: 'user@example.com',
        password: 'secret123',
        query: 'search term'
      };

      const sanitized = sanitizeMCPToolArgs(args);

      expect(sanitized.email).toBe('[MCP_REDACTED]');
      expect(sanitized.password).toBe('[MCP_REDACTED]');
      expect(sanitized.query).toBe('search term');
    });

    it('should sanitize MCP-specific fields', () => {
      const args = {
        mcp_token: 'secret-token-123',
        client_secret: 'client-secret-456',
        model_api_key: 'sk-123456789',
        query: 'search term'
      };

      const sanitized = sanitizeMCPToolArgs(args);

      expect(sanitized.mcp_token).toBe('[MCP_REDACTED]');
      expect(sanitized.client_secret).toBe('[MCP_REDACTED]');
      expect(sanitized.model_api_key).toBe('[MCP_REDACTED]');
      expect(sanitized.query).toBe('search term');
    });

    it('should sanitize nested context data', () => {
      const args = {
        context_data: {
          user_context: {
            apiKey: 'secret-key',
            preferences: { theme: 'dark' }
          },
          session_id: '12345'
        }
      };

      const sanitized = sanitizeMCPToolArgs(args);

      expect(sanitized.context_data).toBe('[MCP_REDACTED]');
    });

    it('should sanitize user context', () => {
      const args = {
        user_context: {
          email: 'user@example.com',
          api_key: 'secret'
        },
        action: 'search'
      };

      const sanitized = sanitizeMCPToolArgs(args);

      expect(sanitized.user_context).toBe('[MCP_REDACTED]');
      expect(sanitized.action).toBe('search');
    });

    it('should sanitize conversation history', () => {
      const args = {
        conversation_history: [
          { role: 'user', content: 'my email is user@example.com' },
          { role: 'assistant', content: 'Got it' }
        ]
      };

      const sanitized = sanitizeMCPToolArgs(args);

      expect(sanitized.conversation_history).toBe('[MCP_REDACTED]');
    });

    it('should sanitize model configuration', () => {
      const args = {
        model_config: {
          api_key: 'secret',
          temperature: 0.7
        },
        prompt: 'test prompt'
      };

      const sanitized = sanitizeMCPToolArgs(args);

      expect(sanitized.model_config).toBe('[MCP_REDACTED]');
      expect(sanitized.prompt).toBe('test prompt');
    });

    it('should sanitize system prompts', () => {
      const args = {
        system_prompt: 'You have access to user data...',
        user_message: 'Hello'
      };

      const sanitized = sanitizeMCPToolArgs(args);

      expect(sanitized.system_prompt).toBe('[MCP_REDACTED]');
      expect(sanitized.user_message).toBe('Hello');
    });

    it('should handle tool credentials', () => {
      const args = {
        tool_credentials: {
          username: 'admin',
          password: 'secret'
        },
        tool_name: 'database_query'
      };

      const sanitized = sanitizeMCPToolArgs(args);

      expect(sanitized.tool_credentials).toBe('[MCP_REDACTED]');
      expect(sanitized.tool_name).toBe('database_query');
    });

    it('should sanitize connection strings', () => {
      const args = {
        connection_string: 'postgresql://user:pass@localhost:5432/db',
        query: 'SELECT * FROM users'
      };

      const sanitized = sanitizeMCPToolArgs(args);

      expect(sanitized.connection_string).toBe('[MCP_REDACTED]');
      expect(sanitized.query).toBe('SELECT * FROM users');
    });

    it('should sanitize database URLs', () => {
      const args = {
        database_url: 'mongodb://admin:password@localhost:27017',
        collection: 'users'
      };

      const sanitized = sanitizeMCPToolArgs(args);

      expect(sanitized.database_url).toBe('[MCP_REDACTED]');
      expect(sanitized.collection).toBe('users');
    });
  });

  describe('sanitizeMCPResponse', () => {
    it('should sanitize response data', () => {
      const response = {
        success: true,
        data: {
          user: {
            email: 'user@example.com',
            name: 'John Doe'
          }
        }
      };

      const sanitized = sanitizeMCPResponse(response);

      expect(sanitized.success).toBe(true);
      expect(sanitized.data.user.email).toBe('[MCP_REDACTED]');
      expect(sanitized.data.user.name).toBe('John Doe');
    });

    it('should sanitize tokens in responses', () => {
      const response = {
        access_token: 'secret-token',
        refresh_token: 'refresh-secret',
        user_id: '12345'
      };

      const sanitized = sanitizeMCPResponse(response);

      expect(sanitized.access_token).toBe('[MCP_REDACTED]');
      expect(sanitized.refresh_token).toBe('[MCP_REDACTED]');
      expect(sanitized.user_id).toBe('[MCP_REDACTED]');
    });
  });

  describe('mcpLoggingMiddleware', () => {
    it('should add safeToolArgs property to request', () => {
      const req: MCPRequest & { safeToolArgs?: any } = {
        toolName: 'test',
        toolArgs: {
          email: 'user@example.com',
          query: 'search'
        },
        requestId: '123',
        timestamp: Date.now()
      };

      const res: MCPResponse = {
        success: true,
        requestId: '123'
      };

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      mcpLoggingMiddleware(req, res, next);

      expect(req.safeToolArgs).toBeDefined();
      expect(req.safeToolArgs.email).toBe('[MCP_REDACTED]');
      expect(req.safeToolArgs.query).toBe('search');
      expect(nextCalled).toBe(true);
    });

    it('should make safeToolArgs read-only', () => {
      const req: MCPRequest & { safeToolArgs?: any } = {
        toolName: 'test',
        toolArgs: { email: 'user@example.com' },
        requestId: '123',
        timestamp: Date.now()
      };

      const res: MCPResponse = {
        success: true,
        requestId: '123'
      };

      mcpLoggingMiddleware(req, res, () => {});

      // Attempt to modify should fail or have no effect
      const attempt = () => {
        req.safeToolArgs = { different: 'value' };
      };

      expect(attempt).toThrow();
    });

    it('should not modify original toolArgs', () => {
      const originalArgs = {
        email: 'user@example.com',
        query: 'search'
      };

      const req: MCPRequest & { safeToolArgs?: any } = {
        toolName: 'test',
        toolArgs: originalArgs,
        requestId: '123',
        timestamp: Date.now()
      };

      const res: MCPResponse = {
        success: true,
        requestId: '123'
      };

      mcpLoggingMiddleware(req, res, () => {});

      // Original args should be unchanged
      expect(req.toolArgs.email).toBe('user@example.com');
      expect(req.toolArgs).toBe(originalArgs);
    });
  });

  describe('createLoggingContext', () => {
    it('should sanitize logging context', () => {
      const context = {
        user_id: '12345',
        email: 'user@example.com',
        action: 'search',
        timestamp: Date.now()
      };

      const sanitized = createLoggingContext(context);

      expect(sanitized.user_id).toBe('[MCP_REDACTED]');
      expect(sanitized.email).toBe('[MCP_REDACTED]');
      expect(sanitized.action).toBe('search');
      expect(sanitized.timestamp).toBeDefined();
    });
  });

  describe('logToolInvocation', () => {
    it('should log with sanitized arguments', () => {
      const loggedData: any[] = [];
      const mockLogger = {
        info: (message: string, context: any) => {
          loggedData.push({ message, context });
        }
      };

      const args = {
        email: 'user@example.com',
        api_key: 'secret-key',
        query: 'search term'
      };

      logToolInvocation(mockLogger, 'search', args, { session_id: '123' });

      expect(loggedData).toHaveLength(1);
      expect(loggedData[0].message).toBe('MCP tool invoked');
      expect(loggedData[0].context.tool).toBe('search');
      expect(loggedData[0].context.args.email).toBe('[MCP_REDACTED]');
      expect(loggedData[0].context.args.api_key).toBe('[MCP_REDACTED]');
      expect(loggedData[0].context.args.query).toBe('search term');
      expect(loggedData[0].context.session_id).toBe('[MCP_REDACTED]');
    });
  });

  describe('logToolCompletion', () => {
    it('should log successful completion with sanitized result', () => {
      const loggedData: any[] = [];
      const mockLogger = {
        info: (message: string, context: any) => {
          loggedData.push({ message, context });
        }
      };

      const result = {
        user: {
          email: 'user@example.com',
          name: 'John Doe'
        },
        count: 42
      };

      logToolCompletion(mockLogger, 'search', true, result);

      expect(loggedData).toHaveLength(1);
      expect(loggedData[0].message).toBe('MCP tool completed');
      expect(loggedData[0].context.success).toBe(true);
      expect(loggedData[0].context.result.user.email).toBe('[MCP_REDACTED]');
      expect(loggedData[0].context.result.user.name).toBe('John Doe');
      expect(loggedData[0].context.result.count).toBe(42);
    });

    it('should not log result on failure', () => {
      const loggedData: any[] = [];
      const mockLogger = {
        info: (message: string, context: any) => {
          loggedData.push({ message, context });
        }
      };

      logToolCompletion(mockLogger, 'search', false, null);

      expect(loggedData[0].context.success).toBe(false);
      expect(loggedData[0].context.result).toBeUndefined();
    });
  });

  describe('logToolError', () => {
    it('should log error with sanitized arguments', () => {
      const loggedData: any[] = [];
      const mockLogger = {
        error: (message: string, context: any) => {
          loggedData.push({ message, context });
        }
      };

      const error = new Error('Tool execution failed');
      const args = {
        email: 'user@example.com',
        query: 'search term'
      };

      logToolError(mockLogger, 'search', error, args);

      expect(loggedData).toHaveLength(1);
      expect(loggedData[0].message).toBe('MCP tool failed');
      expect(loggedData[0].context.tool).toBe('search');
      expect(loggedData[0].context.error.message).toBe('Tool execution failed');
      expect(loggedData[0].context.args.email).toBe('[MCP_REDACTED]');
      expect(loggedData[0].context.args.query).toBe('search term');
    });
  });

  describe('MCP_SENSITIVE_FIELDS', () => {
    it('should include MCP-specific fields', () => {
      expect(MCP_SENSITIVE_FIELDS).toContain('mcp_token');
      expect(MCP_SENSITIVE_FIELDS).toContain('client_secret');
      expect(MCP_SENSITIVE_FIELDS).toContain('model_api_key');
      expect(MCP_SENSITIVE_FIELDS).toContain('context_data');
      expect(MCP_SENSITIVE_FIELDS).toContain('user_context');
    });

    it('should include base sensitive fields', () => {
      expect(MCP_SENSITIVE_FIELDS).toContain('password');
      expect(MCP_SENSITIVE_FIELDS).toContain('email');
      expect(MCP_SENSITIVE_FIELDS).toContain('api_key');
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete request/response cycle', () => {
      const logs: any[] = [];
      const mockLogger = {
        info: (message: string, context: any) => logs.push({ level: 'info', message, context }),
        error: (message: string, context: any) => logs.push({ level: 'error', message, context })
      };

      // Request with sensitive data
      const args = {
        email: 'user@example.com',
        api_key: 'sk-secret-key',
        query: 'find documents'
      };

      // Log invocation
      logToolInvocation(mockLogger, 'search', args);

      // Log completion with result
      const result = {
        documents: [
          { id: 1, title: 'Doc 1', owner_email: 'owner@example.com' }
        ]
      };
      logToolCompletion(mockLogger, 'search', true, result);

      // Verify no sensitive data in logs
      const allLogs = JSON.stringify(logs);
      expect(allLogs).not.toContain('user@example.com');
      expect(allLogs).not.toContain('sk-secret-key');
      expect(allLogs).not.toContain('owner@example.com');
      expect(allLogs).toContain('[MCP_REDACTED]');
      expect(allLogs).toContain('find documents');
    });
  });
});
