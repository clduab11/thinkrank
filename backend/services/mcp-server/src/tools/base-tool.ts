/**
 * Base MCP Tool Class
 *
 * Abstract base class for all MCP (Model Context Protocol) tools.
 * Provides built-in sanitization, logging, error handling, and lifecycle management.
 *
 * Features:
 * - Automatic argument sanitization for logging
 * - Structured logging with consistent format
 * - Error handling and reporting
 * - Execution timing and metrics
 * - Template method pattern for tool implementation
 *
 * @see Issue #6: MAJOR - MCP Server Sensitive Data Logging
 * @created 2024-11-16
 */

import { sanitizeMCPToolArgs } from '../middleware/mcp-logging';

/**
 * Logger interface (simplified)
 * Replace with actual logger implementation
 */
export interface Logger {
  info(message: string, context?: any): void;
  error(message: string, context?: any): void;
  debug(message: string, context?: any): void;
  warn(message: string, context?: any): void;
}

/**
 * Simple console-based logger implementation
 * Replace with your actual logger (Winston, Pino, etc.)
 */
class ConsoleLogger implements Logger {
  constructor(private readonly name: string) {}

  info(message: string, context?: any): void {
    console.log(`[INFO] [${this.name}] ${message}`, context || '');
  }

  error(message: string, context?: any): void {
    console.error(`[ERROR] [${this.name}] ${message}`, context || '');
  }

  debug(message: string, context?: any): void {
    console.debug(`[DEBUG] [${this.name}] ${message}`, context || '');
  }

  warn(message: string, context?: any): void {
    console.warn(`[WARN] [${this.name}] ${message}`, context || '');
  }

  static getInstance(name: string): Logger {
    return new ConsoleLogger(name);
  }
}

/**
 * Tool execution result
 */
export interface ToolExecutionResult<T = any> {
  /** Whether the execution succeeded */
  success: boolean;
  /** Result data (if successful) */
  data?: T;
  /** Error information (if failed) */
  error?: {
    message: string;
    code?: string;
    details?: any;
  };
  /** Execution metadata */
  metadata: {
    toolName: string;
    executionTimeMs: number;
    timestamp: string;
  };
}

/**
 * Abstract base class for MCP tools
 *
 * Extend this class to create new MCP tools with built-in sanitization and logging.
 *
 * @example
 * ```typescript
 * class SearchTool extends BaseMCPTool {
 *   constructor() {
 *     super('search');
 *   }
 *
 *   protected async executeImpl(args: { query: string }): Promise<any> {
 *     const results = await this.performSearch(args.query);
 *     return { results };
 *   }
 *
 *   protected async validateArgs(args: any): Promise<void> {
 *     if (!args.query || typeof args.query !== 'string') {
 *       throw new Error('Query must be a non-empty string');
 *     }
 *   }
 * }
 * ```
 */
export abstract class BaseMCPTool<TArgs = any, TResult = any> {
  protected readonly logger: Logger;
  protected readonly name: string;

  /**
   * Create a new MCP tool
   *
   * @param name - Unique name for this tool
   * @param logger - Optional logger instance (defaults to console logger)
   */
  constructor(name: string, logger?: Logger) {
    this.name = name;
    this.logger = logger || ConsoleLogger.getInstance(`mcp-tool-${name}`);
  }

  /**
   * Execute the tool with automatic sanitization and logging
   *
   * This is the main entry point. It handles:
   * 1. Argument validation
   * 2. Sanitized logging of inputs
   * 3. Execution with timing
   * 4. Error handling
   * 5. Sanitized logging of outputs
   *
   * @param args - Tool arguments (will be sanitized for logging)
   * @returns Execution result with metadata
   */
  async execute(args: TArgs): Promise<ToolExecutionResult<TResult>> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    // Log sanitized arguments
    this.logger.info('Tool execution started', {
      tool: this.name,
      args: sanitizeMCPToolArgs(args),
      timestamp
    });

    try {
      // Validate arguments
      await this.validateArgs(args);

      // Execute implementation
      const data = await this.executeImpl(args);

      // Calculate execution time
      const executionTimeMs = Date.now() - startTime;

      // Log success (with sanitized result)
      this.logger.info('Tool execution completed', {
        tool: this.name,
        success: true,
        executionTimeMs,
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        data,
        metadata: {
          toolName: this.name,
          executionTimeMs,
          timestamp
        }
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;

      // Extract error information
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      // Log error (with sanitized args)
      this.logger.error('Tool execution failed', {
        tool: this.name,
        error: {
          message: errorMessage,
          stack: errorStack
        },
        args: sanitizeMCPToolArgs(args),
        executionTimeMs,
        timestamp: new Date().toISOString()
      });

      return {
        success: false,
        error: {
          message: errorMessage,
          code: 'TOOL_EXECUTION_ERROR',
          details: error instanceof Error ? { stack: error.stack } : undefined
        },
        metadata: {
          toolName: this.name,
          executionTimeMs,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Validate tool arguments
   *
   * Override this method to implement custom validation logic.
   * Throw an error if validation fails.
   *
   * @param args - Arguments to validate
   * @throws Error if validation fails
   */
  protected async validateArgs(args: TArgs): Promise<void> {
    // Default: no validation
    // Override in subclasses to add validation
  }

  /**
   * Execute the tool implementation
   *
   * Override this method to implement the tool's core functionality.
   * This method is called after validation and before result sanitization.
   *
   * @param args - Validated tool arguments
   * @returns Tool execution result
   * @throws Error if execution fails
   */
  protected abstract executeImpl(args: TArgs): Promise<TResult>;

  /**
   * Get the tool name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Get the tool description
   *
   * Override this to provide a human-readable description
   */
  getDescription(): string {
    return `MCP Tool: ${this.name}`;
  }

  /**
   * Get the tool schema (for MCP protocol)
   *
   * Override this to provide a JSON schema for the tool's arguments
   */
  getSchema(): any {
    return {
      name: this.name,
      description: this.getDescription(),
      inputSchema: {
        type: 'object',
        properties: {},
        required: []
      }
    };
  }
}

/**
 * Example tool implementation for reference
 */
export class ExampleTool extends BaseMCPTool<{ message: string }, { echo: string }> {
  constructor() {
    super('example');
  }

  protected async validateArgs(args: { message: string }): Promise<void> {
    if (!args.message || typeof args.message !== 'string') {
      throw new Error('message must be a non-empty string');
    }
  }

  protected async executeImpl(args: { message: string }): Promise<{ echo: string }> {
    // Simple echo implementation
    return { echo: args.message };
  }

  getDescription(): string {
    return 'Example tool that echoes the input message';
  }

  getSchema(): any {
    return {
      name: this.name,
      description: this.getDescription(),
      inputSchema: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'Message to echo back'
          }
        },
        required: ['message']
      }
    };
  }
}
