/**
 * BaseMCPTool - Test Suite
 *
 * Tests for the BaseMCPTool class
 * @see Issue #6: MAJOR - MCP Server Sensitive Data Logging
 */

import { BaseMCPTool, ExampleTool } from '../tools/base-tool';

// Test implementation of BaseMCPTool
class TestTool extends BaseMCPTool<{ message: string }, { result: string }> {
  constructor() {
    super('test-tool');
  }

  protected async executeImpl(args: { message: string }): Promise<{ result: string }> {
    return { result: `Processed: ${args.message}` };
  }

  protected async validateArgs(args: { message: string }): Promise<void> {
    if (!args.message) {
      throw new Error('message is required');
    }
    if (typeof args.message !== 'string') {
      throw new Error('message must be a string');
    }
  }
}

// Failing tool for error testing
class FailingTool extends BaseMCPTool {
  constructor() {
    super('failing-tool');
  }

  protected async executeImpl(args: any): Promise<any> {
    throw new Error('Intentional failure');
  }
}

// Tool with async validation
class AsyncValidationTool extends BaseMCPTool {
  constructor() {
    super('async-validation-tool');
  }

  protected async validateArgs(args: any): Promise<void> {
    // Simulate async validation (e.g., database check)
    await new Promise(resolve => setTimeout(resolve, 10));

    if (!args.valid) {
      throw new Error('Validation failed');
    }
  }

  protected async executeImpl(args: any): Promise<any> {
    return { success: true };
  }
}

describe('BaseMCPTool', () => {
  describe('execute', () => {
    it('should execute successfully with valid arguments', async () => {
      const tool = new TestTool();
      const result = await tool.execute({ message: 'Hello' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ result: 'Processed: Hello' });
      expect(result.error).toBeUndefined();
      expect(result.metadata.toolName).toBe('test-tool');
      expect(result.metadata.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should include execution metadata', async () => {
      const tool = new TestTool();
      const result = await tool.execute({ message: 'Test' });

      expect(result.metadata).toBeDefined();
      expect(result.metadata.toolName).toBe('test-tool');
      expect(typeof result.metadata.executionTimeMs).toBe('number');
      expect(result.metadata.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should measure execution time', async () => {
      class SlowTool extends BaseMCPTool {
        protected async executeImpl(args: any): Promise<any> {
          await new Promise(resolve => setTimeout(resolve, 50));
          return { done: true };
        }
      }

      const tool = new SlowTool('slow-tool');
      const result = await tool.execute({});

      expect(result.metadata.executionTimeMs).toBeGreaterThanOrEqual(50);
    });

    it('should fail validation with invalid arguments', async () => {
      const tool = new TestTool();
      const result = await tool.execute({ message: '' as any });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('message is required');
      expect(result.data).toBeUndefined();
    });

    it('should handle execution errors', async () => {
      const tool = new FailingTool();
      const result = await tool.execute({ test: 'data' });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Intentional failure');
      expect(result.error?.code).toBe('TOOL_EXECUTION_ERROR');
      expect(result.data).toBeUndefined();
    });

    it('should handle async validation', async () => {
      const tool = new AsyncValidationTool();

      // Valid args
      const validResult = await tool.execute({ valid: true });
      expect(validResult.success).toBe(true);

      // Invalid args
      const invalidResult = await tool.execute({ valid: false });
      expect(invalidResult.success).toBe(false);
      expect(invalidResult.error?.message).toContain('Validation failed');
    });
  });

  describe('Logging Sanitization', () => {
    it('should sanitize sensitive data in logs', async () => {
      const loggedMessages: any[] = [];

      // Create tool with custom logger that captures logs
      class LogCaptureTool extends BaseMCPTool {
        constructor() {
          super('log-capture-tool', {
            info: (message: string, context: any) => {
              loggedMessages.push({ level: 'info', message, context });
            },
            error: (message: string, context: any) => {
              loggedMessages.push({ level: 'error', message, context });
            },
            debug: jest.fn(),
            warn: jest.fn()
          });
        }

        protected async executeImpl(args: any): Promise<any> {
          return { success: true };
        }
      }

      const tool = new LogCaptureTool();
      await tool.execute({
        email: 'user@example.com',
        password: 'secret123',
        query: 'search term'
      });

      // Check that sensitive data was sanitized in logs
      const allLogs = JSON.stringify(loggedMessages);

      expect(allLogs).not.toContain('user@example.com');
      expect(allLogs).not.toContain('secret123');
      expect(allLogs).toContain('[MCP_REDACTED]');
      expect(allLogs).toContain('search term'); // Non-sensitive data preserved
    });

    it('should sanitize sensitive data in error logs', async () => {
      const errorLogs: any[] = [];

      class ErrorLoggingTool extends BaseMCPTool {
        constructor() {
          super('error-logging-tool', {
            info: jest.fn(),
            error: (message: string, context: any) => {
              errorLogs.push({ message, context });
            },
            debug: jest.fn(),
            warn: jest.fn()
          });
        }

        protected async executeImpl(args: any): Promise<any> {
          throw new Error('Tool failed');
        }
      }

      const tool = new ErrorLoggingTool();
      await tool.execute({
        apiKey: 'sk-secret-key',
        email: 'user@example.com',
        data: 'public data'
      });

      const allErrorLogs = JSON.stringify(errorLogs);

      expect(allErrorLogs).not.toContain('sk-secret-key');
      expect(allErrorLogs).not.toContain('user@example.com');
      expect(allErrorLogs).toContain('[MCP_REDACTED]');
      expect(allErrorLogs).toContain('public data');
    });
  });

  describe('getName', () => {
    it('should return tool name', () => {
      const tool = new TestTool();
      expect(tool.getName()).toBe('test-tool');
    });
  });

  describe('getDescription', () => {
    it('should return default description', () => {
      const tool = new TestTool();
      expect(tool.getDescription()).toContain('test-tool');
    });

    it('should return custom description when overridden', () => {
      class CustomDescTool extends BaseMCPTool {
        protected async executeImpl(args: any): Promise<any> {
          return {};
        }

        getDescription(): string {
          return 'Custom description for this tool';
        }
      }

      const tool = new CustomDescTool('custom');
      expect(tool.getDescription()).toBe('Custom description for this tool');
    });
  });

  describe('getSchema', () => {
    it('should return tool schema', () => {
      const tool = new TestTool();
      const schema = tool.getSchema();

      expect(schema).toHaveProperty('name');
      expect(schema).toHaveProperty('description');
      expect(schema).toHaveProperty('inputSchema');
    });

    it('should return custom schema when overridden', () => {
      const tool = new ExampleTool();
      const schema = tool.getSchema();

      expect(schema.name).toBe('example');
      expect(schema.inputSchema.properties).toHaveProperty('message');
      expect(schema.inputSchema.required).toContain('message');
    });
  });

  describe('ExampleTool', () => {
    it('should echo the input message', async () => {
      const tool = new ExampleTool();
      const result = await tool.execute({ message: 'Hello, World!' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ echo: 'Hello, World!' });
    });

    it('should validate message argument', async () => {
      const tool = new ExampleTool();
      const result = await tool.execute({ message: '' });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('non-empty string');
    });

    it('should have correct schema', () => {
      const tool = new ExampleTool();
      const schema = tool.getSchema();

      expect(schema.name).toBe('example');
      expect(schema.description).toContain('echo');
      expect(schema.inputSchema.type).toBe('object');
      expect(schema.inputSchema.properties.message.type).toBe('string');
    });
  });

  describe('Edge Cases', () => {
    it('should handle null arguments', async () => {
      const tool = new TestTool();
      const result = await tool.execute(null as any);

      expect(result.success).toBe(false);
    });

    it('should handle undefined arguments', async () => {
      const tool = new TestTool();
      const result = await tool.execute(undefined as any);

      expect(result.success).toBe(false);
    });

    it('should handle empty object arguments', async () => {
      const tool = new TestTool();
      const result = await tool.execute({} as any);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('required');
    });

    it('should handle very large argument objects', async () => {
      class LargeArgTool extends BaseMCPTool {
        protected async executeImpl(args: any): Promise<any> {
          return { processed: Object.keys(args).length };
        }
      }

      const tool = new LargeArgTool('large-arg-tool');
      const largeArgs: any = {};
      for (let i = 0; i < 1000; i++) {
        largeArgs[`field${i}`] = `value${i}`;
      }

      const result = await tool.execute(largeArgs);

      expect(result.success).toBe(true);
      expect(result.data.processed).toBe(1000);
    });
  });

  describe('Error Handling', () => {
    it('should include error stack in result', async () => {
      const tool = new FailingTool();
      const result = await tool.execute({});

      expect(result.error?.details).toBeDefined();
      expect(result.error?.details?.stack).toBeDefined();
    });

    it('should handle non-Error exceptions', async () => {
      class StringThrowTool extends BaseMCPTool {
        protected async executeImpl(args: any): Promise<any> {
          throw 'String error'; // Non-Error exception
        }
      }

      const tool = new StringThrowTool('string-throw');
      const result = await tool.execute({});

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('String error');
    });
  });
});
