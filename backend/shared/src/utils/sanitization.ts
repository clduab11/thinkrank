/**
 * PII Sanitization Utilities
 *
 * Provides comprehensive sanitization of personally identifiable information (PII)
 * and sensitive data from logs, tool arguments, and other data structures.
 *
 * GDPR/CCPA Compliance:
 * - Redacts email addresses, phone numbers, SSNs, credit cards
 * - Handles JWT tokens, API keys, passwords
 * - Configurable sensitive field detection
 * - Maintains data utility while protecting privacy
 *
 * @see Issue #2: CRITICAL - PII Exposure in Tool Argument Logging
 * @created 2024-11-16
 */

/**
 * Configuration options for sanitization behavior
 */
export interface SanitizationConfig {
  /** List of field names to treat as sensitive (case-insensitive) */
  sensitiveFields: string[];
  /** Text to replace redacted values with */
  redactionText: string;
  /** Maximum depth to traverse nested objects (prevents infinite recursion) */
  maxDepth: number;
}

/**
 * Default sensitive field patterns
 * Covers common PII and security-sensitive fields
 */
export const DEFAULT_SENSITIVE_FIELDS = [
  // Authentication & Authorization
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'api_key',
  'apikey',
  'api-key',
  'access_token',
  'refresh_token',
  'auth_token',
  'bearer',
  'authorization',
  'jwt',
  'session_id',
  'sessionid',

  // Personal Information
  'email',
  'email_address',
  'phone',
  'phone_number',
  'mobile',
  'ssn',
  'social_security',
  'credit_card',
  'creditcard',
  'card_number',
  'cvv',
  'cvv2',
  'security_code',

  // Identifiers
  'user_id',
  'userid',
  'username',
  'account_id',
  'accountid',
  'customer_id',
  'ip_address',
  'ipaddress',
  'ip',

  // Privacy-Sensitive
  'address',
  'street',
  'city',
  'zip',
  'zipcode',
  'postal_code',
  'date_of_birth',
  'dob',
  'birth_date',
  'birthdate',

  // Application-Specific
  'private_key',
  'privatekey',
  'encryption_key',
  'signing_key'
];

/**
 * Default sanitization configuration
 */
export const DEFAULT_CONFIG: SanitizationConfig = {
  sensitiveFields: DEFAULT_SENSITIVE_FIELDS,
  redactionText: '[REDACTED]',
  maxDepth: 5
};

/**
 * Regular expressions for detecting PII patterns in string values
 */
const PII_PATTERNS = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  phone: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  creditCard: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g,
  ipAddress: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  jwt: /eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_.+/=]*/g,
  apiKey: /\b[A-Za-z0-9]{32,}\b/g // Generic long alphanumeric strings
};

/**
 * Tracks visited objects to prevent infinite recursion with circular references
 */
const VISITED = new WeakSet();

/**
 * Check if a field name matches any sensitive field pattern
 * Uses case-insensitive matching
 */
function isSensitiveField(fieldName: string, sensitiveFields: string[]): boolean {
  const lowerFieldName = fieldName.toLowerCase();
  return sensitiveFields.some(pattern =>
    lowerFieldName.includes(pattern.toLowerCase())
  );
}

/**
 * Detect if a string contains PII patterns
 *
 * @param text - String to analyze
 * @returns true if any PII pattern is detected
 */
export function detectPII(text: string): boolean {
  if (typeof text !== 'string') return false;

  return Object.values(PII_PATTERNS).some(pattern => {
    // Reset regex lastIndex to ensure consistent matching
    pattern.lastIndex = 0;
    return pattern.test(text);
  });
}

/**
 * Redact PII patterns from a string value
 *
 * @param text - String to sanitize
 * @param redactionText - Replacement text for detected PII
 * @returns Sanitized string with PII replaced
 */
export function redactPIIFromString(text: string, redactionText: string = '[REDACTED]'): string {
  if (typeof text !== 'string') return text;

  let sanitized = text;

  // Apply each PII pattern
  for (const pattern of Object.values(PII_PATTERNS)) {
    pattern.lastIndex = 0;
    sanitized = sanitized.replace(pattern, redactionText);
  }

  return sanitized;
}

/**
 * Sanitize a single value based on type and content
 *
 * @param value - Value to sanitize
 * @param config - Sanitization configuration
 * @param depth - Current recursion depth
 * @returns Sanitized value
 */
function sanitizeValue(
  value: any,
  config: SanitizationConfig,
  depth: number
): any {
  // Prevent deep recursion
  if (depth > config.maxDepth) {
    return '[MAX_DEPTH_EXCEEDED]';
  }

  // Handle null and undefined
  if (value === null || value === undefined) {
    return value;
  }

  // Handle primitives
  if (typeof value === 'boolean' || typeof value === 'number') {
    return value;
  }

  // Handle strings - check for PII patterns
  if (typeof value === 'string') {
    if (detectPII(value)) {
      return redactPIIFromString(value, config.redactionText);
    }
    return value;
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return value.map(item => sanitizeValue(item, config, depth + 1));
  }

  // Handle objects
  if (typeof value === 'object') {
    return sanitizeObject(value, config, depth);
  }

  // Handle functions, symbols, etc.
  return '[UNSUPPORTED_TYPE]';
}

/**
 * Sanitize an object by redacting sensitive fields and PII
 *
 * @param obj - Object to sanitize
 * @param config - Sanitization configuration
 * @param depth - Current recursion depth
 * @returns Sanitized object
 */
function sanitizeObject(
  obj: any,
  config: SanitizationConfig,
  depth: number
): any {
  // Prevent circular reference infinite loops
  if (VISITED.has(obj)) {
    return '[CIRCULAR_REFERENCE]';
  }

  // Mark as visited
  VISITED.add(obj);

  try {
    const sanitized: any = {};

    for (const [key, value] of Object.entries(obj)) {
      // Check if field name is sensitive
      if (isSensitiveField(key, config.sensitiveFields)) {
        sanitized[key] = config.redactionText;
      } else {
        sanitized[key] = sanitizeValue(value, config, depth + 1);
      }
    }

    return sanitized;
  } finally {
    // Always remove from visited set to allow re-sanitization
    VISITED.delete(obj);
  }
}

/**
 * Sanitize tool arguments by redacting sensitive data
 *
 * Main entry point for sanitization. Use this function to sanitize
 * any data structure before logging or transmission.
 *
 * @param data - Data to sanitize (object, array, or primitive)
 * @param config - Optional configuration overrides
 * @returns Sanitized copy of the data
 *
 * @example
 * ```typescript
 * const args = {
 *   email: 'user@example.com',
 *   apiKey: 'secret-key-123',
 *   query: 'search term'
 * };
 *
 * const sanitized = sanitizeToolArgs(args);
 * // Result: { email: '[REDACTED]', apiKey: '[REDACTED]', query: 'search term' }
 * ```
 */
export function sanitizeToolArgs(
  data: any,
  config: Partial<SanitizationConfig> = {}
): any {
  const finalConfig: SanitizationConfig = {
    ...DEFAULT_CONFIG,
    ...config
  };

  return sanitizeValue(data, finalConfig, 0);
}

/**
 * Create a custom sanitization function with predefined configuration
 *
 * @param config - Custom sanitization configuration
 * @returns Configured sanitization function
 *
 * @example
 * ```typescript
 * const sanitizeMCP = createSanitizer({
 *   sensitiveFields: [...DEFAULT_SENSITIVE_FIELDS, 'mcp_token'],
 *   redactionText: '[MCP_REDACTED]'
 * });
 *
 * const sanitized = sanitizeMCP(mcpArgs);
 * ```
 */
export function createSanitizer(
  config: Partial<SanitizationConfig>
): (data: any) => any {
  return (data: any) => sanitizeToolArgs(data, config);
}

/**
 * Batch sanitize multiple data items
 *
 * @param items - Array of data items to sanitize
 * @param config - Optional configuration overrides
 * @returns Array of sanitized items
 */
export function sanitizeBatch(
  items: any[],
  config: Partial<SanitizationConfig> = {}
): any[] {
  return items.map(item => sanitizeToolArgs(item, config));
}
