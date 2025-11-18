/**
 * Sanitization utilities for PII and sensitive data protection
 *
 * This module provides comprehensive data sanitization for logging and external communication,
 * ensuring GDPR/CCPA compliance by redacting personally identifiable information (PII).
 *
 * @module sanitization
 * @see CRITICAL-02-pii-logging-exposure.md
 * @created 2024-11-16
 * @updated 2024-11-16
 */

export interface SanitizationConfig {
  /** List of field names considered sensitive */
  sensitiveFields: string[];
  /** Text to use for redacted values */
  redactionText: string;
  /** Maximum object depth to traverse */
  maxDepth: number;
}

export const DEFAULT_CONFIG: SanitizationConfig = {
  sensitiveFields: [
    // Authentication & Authorization
    'password', 'passwd', 'pwd',
    'token', 'accessToken', 'refreshToken', 'access_token', 'refresh_token',
    'apiKey', 'api_key', 'secret', 'secretKey', 'secret_key',
    'authorization', 'auth', 'bearer',
    'jwt', 'session', 'sessionId', 'session_id',
    'cookie', 'cookies',

    // Personal Information
    'email', 'emailAddress', 'email_address',
    'phone', 'phoneNumber', 'phone_number', 'mobile',
    'ssn', 'social_security', 'socialSecurity',
    'address', 'street', 'city', 'zipcode', 'zip', 'postal',
    'dob', 'dateOfBirth', 'date_of_birth', 'birthday',

    // Financial
    'creditCard', 'credit_card', 'cardNumber', 'card_number',
    'cvv', 'cvc', 'expiry', 'expiryDate',
    'bankAccount', 'bank_account', 'accountNumber', 'account_number',
    'routing', 'routingNumber', 'routing_number',

    // Identifiers
    'userId', 'user_id', 'username',
    'clientId', 'client_id', 'clientSecret', 'client_secret',

    // AI/MCP Specific
    'mcp_token', 'model_api_key', 'context_data', 'user_context'
  ],
  redactionText: '[REDACTED]',
  maxDepth: 5
};

/**
 * Sanitizes data by redacting sensitive fields
 *
 * @param data - Data to sanitize (any type)
 * @param config - Optional configuration override
 * @returns Sanitized copy of data with sensitive fields redacted
 *
 * @example
 * ```typescript
 * const data = { email: 'user@example.com', name: 'John' };
 * const safe = sanitizeToolArgs(data);
 * // Result: { email: '[REDACTED]', name: 'John' }
 * ```
 */
export function sanitizeToolArgs(
  data: any,
  config: Partial<SanitizationConfig> = {}
): any {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  return sanitizeObject(data, finalConfig, 0);
}

/**
 * Internal recursive sanitization function
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
  // Depth protection
  if (depth > config.maxDepth) {
    return '[MAX_DEPTH_EXCEEDED]';
  }

  // Null/undefined passthrough
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Primitive passthrough
  if (typeof obj !== 'object') {
    return obj;
  }

  // Array handling
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, config, depth + 1));
  }

  // Date handling
  if (obj instanceof Date) {
    return obj;
  }

  // Object sanitization
  return Object.entries(obj).reduce((acc, [key, value]) => {
    // Check if field is sensitive (case-insensitive partial match)
    const isSensitive = config.sensitiveFields.some(
      sensitiveField => key.toLowerCase().includes(sensitiveField.toLowerCase())
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

/**
 * Detects if text contains PII using regex patterns
 *
 * @param text - Text to analyze
 * @returns True if PII patterns detected
 *
 * @example
 * ```typescript
 * detectPII('Contact: user@example.com'); // true
 * detectPII('Hello world'); // false
 * ```
 */
export function detectPII(text: string): boolean {
  const patterns = {
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
    phone: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
    ssn: /\d{3}-\d{2}-\d{4}/,
    creditCard: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/,
    ipAddress: /\b(?:\d{1,3}\.){3}\d{1,3}\b/,
    jwt: /eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_.+/=]*/
  };

  return Object.values(patterns).some(pattern => pattern.test(text));
}

/**
 * Sanitizes a string by redacting detected PII
 *
 * @param text - Text to sanitize
 * @param redactionText - Text to use for redaction
 * @returns Sanitized text
 *
 * @example
 * ```typescript
 * sanitizeString('Email: user@example.com');
 * // Result: 'Email: [EMAIL_REDACTED]'
 * ```
 */
export function sanitizeString(
  text: string,
  redactionText = '[PII_REDACTED]'
): string {
  let sanitized = text;

  // Redact emails
  sanitized = sanitized.replace(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    '[EMAIL_REDACTED]'
  );

  // Redact phone numbers
  sanitized = sanitized.replace(
    /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    '[PHONE_REDACTED]'
  );

  // Redact SSNs
  sanitized = sanitized.replace(
    /\d{3}-\d{2}-\d{4}/g,
    '[SSN_REDACTED]'
  );

  // Redact credit cards
  sanitized = sanitized.replace(
    /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g,
    '[CARD_REDACTED]'
  );

  // Redact IP addresses
  sanitized = sanitized.replace(
    /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    '[IP_REDACTED]'
  );

  // Redact JWTs
  sanitized = sanitized.replace(
    /eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_.+/=]*/g,
    '[JWT_REDACTED]'
  );

  return sanitized;
}

/**
 * Creates a sanitization configuration for specific use cases
 *
 * @param additionalFields - Additional fields to consider sensitive
 * @param redactionText - Custom redaction text
 * @returns Sanitization configuration
 */
export function createSanitizationConfig(
  additionalFields: string[] = [],
  redactionText = '[REDACTED]'
): SanitizationConfig {
  return {
    ...DEFAULT_CONFIG,
    sensitiveFields: [...DEFAULT_CONFIG.sensitiveFields, ...additionalFields],
    redactionText
  };
}

/**
 * Sanitizes error objects for safe logging
 *
 * @param error - Error object to sanitize
 * @returns Sanitized error information
 */
export function sanitizeError(error: any): any {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: sanitizeString(error.message),
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
    };
  }

  return sanitizeToolArgs(error);
}
