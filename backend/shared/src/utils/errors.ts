// Error handling utilities and custom error classes

interface ErrorDetails {
  [key: string]: unknown;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code: string;
  public readonly details?: ErrorDetails;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
    details?: ErrorDetails
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Authentication errors
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed', details?: ErrorDetails) {
    super(message, 401, 'AUTHENTICATION_ERROR', true, details);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied', details?: ErrorDetails) {
    super(message, 403, 'AUTHORIZATION_ERROR', true, details);
  }
}

export class TokenExpiredError extends AppError {
  constructor(message: string = 'Token has expired', details?: ErrorDetails) {
    super(message, 401, 'TOKEN_EXPIRED', true, details);
  }
}

// Validation errors
export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed', details?: ErrorDetails) {
    super(message, 400, 'VALIDATION_ERROR', true, details);
  }
}

export class DuplicateResourceError extends AppError {
  constructor(resource: string, field: string, value: string) {
    super(
      `${resource} with ${field} '${value}' already exists`,
      409,
      'DUPLICATE_RESOURCE',
      true,
      { resource, field, value }
    );
  }
}

// Resource errors
export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, 404, 'NOT_FOUND', true, { resource, identifier });
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict', details?: ErrorDetails) {
    super(message, 409, 'CONFLICT', true, details);
  }
}

// Business logic errors
export class BusinessLogicError extends AppError {
  constructor(message: string, details?: ErrorDetails) {
    super(message, 422, 'BUSINESS_LOGIC_ERROR', true, details);
  }
}

export class InsufficientPermissionsError extends AppError {
  constructor(action: string, resource: string) {
    super(
      `Insufficient permissions to ${action} ${resource}`,
      403,
      'INSUFFICIENT_PERMISSIONS',
      true,
      { action, resource }
    );
  }
}

export class RateLimitError extends AppError {
  constructor(limit: number, windowMs: number) {
    super(
      `Rate limit exceeded. Maximum ${limit} requests per ${windowMs}ms`,
      429,
      'RATE_LIMIT_EXCEEDED',
      true,
      { limit, windowMs }
    );
  }
}

// External service errors
export class ExternalServiceError extends AppError {
  constructor(service: string, message: string = 'External service error', details?: ErrorDetails) {
    super(`${service}: ${message}`, 502, 'EXTERNAL_SERVICE_ERROR', true, { service, ...details });
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed', details?: ErrorDetails) {
    super(message, 500, 'DATABASE_ERROR', false, details);
  }
}

// Payment errors
export class PaymentError extends AppError {
  constructor(message: string = 'Payment processing failed', details?: ErrorDetails) {
    super(message, 402, 'PAYMENT_ERROR', true, details);
  }
}

export class SubscriptionError extends AppError {
  constructor(message: string = 'Subscription error', details?: ErrorDetails) {
    super(message, 400, 'SUBSCRIPTION_ERROR', true, details);
  }
}

// Research-specific errors
export class ResearchValidationError extends AppError {
  constructor(message: string = 'Research validation failed', details?: ErrorDetails) {
    super(message, 422, 'RESEARCH_VALIDATION_ERROR', true, details);
  }
}

export class ContributionError extends AppError {
  constructor(message: string = 'Contribution processing failed', details?: ErrorDetails) {
    super(message, 422, 'CONTRIBUTION_ERROR', true, details);
  }
}

// Error response formatter
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ErrorDetails;
  };
  meta: {
    timestamp: string;
    request_id?: string;
    version: string;
  };
}

export class ErrorFormatter {
  static format(error: AppError, requestId?: string, version: string = '1.0.0'): ErrorResponse {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      },
      meta: {
        timestamp: new Date().toISOString(),
        request_id: requestId,
        version
      }
    };
  }

  static formatValidationError(
    validationErrors: Array<{ field: string; message: string; code: string }>,
    requestId?: string,
    version: string = '1.0.0'
  ): ErrorResponse {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: {
          validation_errors: validationErrors
        }
      },
      meta: {
        timestamp: new Date().toISOString(),
        request_id: requestId,
        version
      }
    };
  }

  static formatUnexpectedError(requestId?: string, version: string = '1.0.0'): ErrorResponse {
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        details: null
      },
      meta: {
        timestamp: new Date().toISOString(),
        request_id: requestId,
        version
      }
    };
  }
}

import { Request, Response, NextFunction } from 'express';

interface Logger {
  warn: (message: string, data?: ErrorDetails) => void;
  error: (message: string, data?: ErrorDetails) => void;
}

interface SupabaseError {
  code?: string;
  message?: string;
  details?: ErrorDetails;
}

// Error handler utility
export class ErrorHandler {
  // Check if error is operational (expected) or programming error
  static isOperationalError(error: Error): boolean {
    if (error instanceof AppError) {
      return error.isOperational;
    }
    return false;
  }

  // Extract status code from error
  static getStatusCode(error: Error): number {
    if (error instanceof AppError) {
      return error.statusCode;
    }
    return 500;
  }

  // Get error code for logging and tracking
  static getErrorCode(error: Error): string {
    if (error instanceof AppError) {
      return error.code;
    }
    return 'UNKNOWN_ERROR';
  }

  // Sanitize error for client response (remove sensitive information)
  static sanitizeError(error: AppError, includeStack: boolean = false): Partial<AppError> {
    const sanitized: Partial<AppError> = {
      message: error.message,
      statusCode: error.statusCode,
      code: error.code,
      details: error.details
    };

    if (includeStack && process.env.NODE_ENV === 'development') {
      sanitized.stack = error.stack;
    }

    return sanitized;
  }

  // Handle async errors in Express middleware
  static asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  // Create error from Supabase error
  static fromSupabaseError(supabaseError: SupabaseError): AppError {
    const { code, message, details } = supabaseError;

    switch (code) {
      case '23505': // unique_violation
        return new DuplicateResourceError('Resource', 'field', 'value');
      case '23503': // foreign_key_violation
        return new ValidationError('Referenced resource does not exist');
      case '42501': // insufficient_privilege
        return new AuthorizationError('Insufficient database privileges');
      case 'PGRST116': // Row not found
        return new NotFoundError('Resource');
      default:
        return new DatabaseError(message || 'Database operation failed', details);
    }
  }

  // Log error with appropriate level
  static logError(error: Error, logger: Logger, context?: ErrorDetails): void {
    const errorCode = this.getErrorCode(error);
    const isOperational = this.isOperationalError(error);

    const logData = {
      error_code: errorCode,
      message: error.message,
      stack: error.stack,
      is_operational: isOperational,
      context
    };

    if (isOperational) {
      logger.warn('Operational error occurred', logData);
    } else {
      logger.error('Programming error occurred', logData);
    }
  }
}

// Type guards for error checking
export const isAppError = (error: unknown): error is AppError => {
  return error instanceof AppError;
};

export const isValidationError = (error: unknown): error is ValidationError => {
  return error instanceof ValidationError;
};

export const isAuthenticationError = (error: unknown): error is AuthenticationError => {
  return error instanceof AuthenticationError;
};

export const isNotFoundError = (error: unknown): error is NotFoundError => {
  return error instanceof NotFoundError;
};
