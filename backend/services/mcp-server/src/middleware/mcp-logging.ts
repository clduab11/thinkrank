/**
 * MCP Server Logging Middleware
 *
 * Provides MCP-specific sanitization for Model Context Protocol server logging.
 * Extends the base sanitization utility with MCP-specific sensitive fields.
 *
 * Security Features:
 * - Automatic sanitization of MCP tool arguments
 * - MCP-specific sensitive field detection
 * - Request/response logging middleware
 * - Integration with base sanitization from Issue #2
 *
 * @see Issue #6: MAJOR - MCP Server Sensitive Data Logging
 * @see Issue #2: CRITICAL - PII Exposure in Tool Argument Logging
 * @created 2024-11-16
 */

import { sanitizeToolArgs, DEFAULT_SENSITIVE_FIELDS, SanitizationConfig } from '../../../../shared/src/utils/sanitization';

/**
 * MCP-specific sensitive field patterns
 * These extend the base sensitive fields with MCP protocol-specific fields
 */
export const MCP_SENSITIVE_FIELDS = [
  ...DEFAULT_SENSITIVE_FIELDS,

  // MCP Protocol Fields
  'mcp_token',
  'mcp_secret',
  'client_secret',
  'client_id',
  'model_api_key',
  'model_token',

  // Context and State
  'context_data',
  'user_context',
  'session_context',
  'state_data',
  'conversation_history',

  // Tool-Specific
  'tool_secret',
  'tool_credentials',
  'connection_string',
  'database_url',

  // Model Configuration
  'model_config',
  'prompt_template', // May contain sensitive instructions
  'system_prompt' // May contain sensitive context
];

/**
 * MCP-specific sanitization configuration
 */
export const MCP_SANITIZATION_CONFIG: Partial<SanitizationConfig> = {
  sensitiveFields: MCP_SENSITIVE_FIELDS,
  redactionText: '[MCP_REDACTED]',
  maxDepth: 5
};

/**
 * Sanitize MCP tool arguments for logging
 *
 * @param args - MCP tool arguments to sanitize
 * @returns Sanitized arguments safe for logging
 *
 * @example
 * ```typescript
 * const args = {
 *   mcp_token: 'secret-token-123',
 *   user_data: { email: 'user@example.com' },
 *   query: 'search term'
 * };
 *
 * const sanitized = sanitizeMCPToolArgs(args);
 * // Result: {
 * //   mcp_token: '[MCP_REDACTED]',
 * //   user_data: { email: '[MCP_REDACTED]' },
 * //   query: 'search term'
 * // }
 * ```
 */
export function sanitizeMCPToolArgs(args: any): any {
  return sanitizeToolArgs(args, MCP_SANITIZATION_CONFIG);
}

/**
 * Sanitize MCP response data for logging
 *
 * @param response - MCP response to sanitize
 * @returns Sanitized response safe for logging
 */
export function sanitizeMCPResponse(response: any): any {
  return sanitizeToolArgs(response, MCP_SANITIZATION_CONFIG);
}

/**
 * MCP Request interface (simplified)
 */
export interface MCPRequest {
  toolName: string;
  toolArgs: any;
  requestId: string;
  timestamp: number;
}

/**
 * MCP Response interface (simplified)
 */
export interface MCPResponse {
  success: boolean;
  data?: any;
  error?: Error;
  requestId: string;
}

/**
 * Next function type for middleware chain
 */
export type NextFunction = () => void | Promise<void>;

/**
 * MCP Logging Middleware
 *
 * Automatically sanitizes tool arguments for all MCP requests.
 * Adds a `safeToolArgs` property to the request object containing
 * sanitized arguments safe for logging.
 *
 * @param req - MCP request object
 * @param res - MCP response object
 * @param next - Next middleware function
 *
 * @example
 * ```typescript
 * app.use(mcpLoggingMiddleware);
 *
 * // In your handler:
 * logger.info('Tool invoked', {
 *   tool: req.toolName,
 *   args: req.safeToolArgs // Already sanitized
 * });
 * ```
 */
export function mcpLoggingMiddleware(
  req: MCPRequest & { safeToolArgs?: any },
  res: MCPResponse,
  next: NextFunction
): void {
  // Store original args (immutable)
  const originalArgs = req.toolArgs;

  // Create sanitized version
  const sanitizedArgs = sanitizeMCPToolArgs(originalArgs);

  // Add sanitized args as read-only property
  Object.defineProperty(req, 'safeToolArgs', {
    value: sanitizedArgs,
    writable: false,
    enumerable: true,
    configurable: false
  });

  // Continue to next middleware
  next();
}

/**
 * Create a logging context with sanitized data
 *
 * @param context - Raw logging context
 * @returns Sanitized logging context
 *
 * @example
 * ```typescript
 * const context = createLoggingContext({
 *   user_id: '12345',
 *   email: 'user@example.com',
 *   action: 'search'
 * });
 *
 * logger.info('User action', context);
 * ```
 */
export function createLoggingContext(context: Record<string, any>): Record<string, any> {
  return sanitizeMCPToolArgs(context);
}

/**
 * Log MCP tool invocation with automatic sanitization
 *
 * @param logger - Logger instance
 * @param toolName - Name of the tool being invoked
 * @param args - Tool arguments (will be sanitized)
 * @param additionalContext - Additional context to log
 */
export function logToolInvocation(
  logger: any,
  toolName: string,
  args: any,
  additionalContext: Record<string, any> = {}
): void {
  logger.info('MCP tool invoked', {
    tool: toolName,
    args: sanitizeMCPToolArgs(args),
    ...createLoggingContext(additionalContext),
    timestamp: new Date().toISOString()
  });
}

/**
 * Log MCP tool completion with automatic sanitization
 *
 * @param logger - Logger instance
 * @param toolName - Name of the tool
 * @param success - Whether the tool succeeded
 * @param result - Tool result (will be sanitized)
 * @param additionalContext - Additional context to log
 */
export function logToolCompletion(
  logger: any,
  toolName: string,
  success: boolean,
  result: any,
  additionalContext: Record<string, any> = {}
): void {
  logger.info('MCP tool completed', {
    tool: toolName,
    success,
    result: success ? sanitizeMCPResponse(result) : undefined,
    ...createLoggingContext(additionalContext),
    timestamp: new Date().toISOString()
  });
}

/**
 * Log MCP tool error with automatic sanitization
 *
 * @param logger - Logger instance
 * @param toolName - Name of the tool
 * @param error - Error that occurred
 * @param args - Tool arguments that caused the error (will be sanitized)
 * @param additionalContext - Additional context to log
 */
export function logToolError(
  logger: any,
  toolName: string,
  error: Error,
  args: any,
  additionalContext: Record<string, any> = {}
): void {
  logger.error('MCP tool failed', {
    tool: toolName,
    error: {
      message: error.message,
      name: error.name,
      stack: error.stack
    },
    args: sanitizeMCPToolArgs(args),
    ...createLoggingContext(additionalContext),
    timestamp: new Date().toISOString()
  });
}
