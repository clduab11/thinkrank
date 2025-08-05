import { Request, Response, NextFunction } from 'express';
import { logger } from '@thinkrank/shared';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
  isOperational?: boolean;
}

export class CustomError extends Error implements ApiError {
  public statusCode: number;
  public code: string;
  public details?: any;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, code?: string, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || 'INTERNAL_ERROR';
    this.details = details;
    this.isOperational = true;
    this.name = this.constructor.name;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends CustomError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends CustomError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends CustomError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends CustomError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends CustomError {
  constructor(message: string, details?: any) {
    super(message, 409, 'CONFLICT', details);
  }
}

export class RateLimitError extends CustomError {
  constructor(message: string = 'Rate limit exceeded', retryAfter?: number) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', { retryAfter });
  }
}

export class ServiceUnavailableError extends CustomError {
  constructor(message: string = 'Service temporarily unavailable') {
    super(message, 503, 'SERVICE_UNAVAILABLE');
  }
}

export function errorHandler(err: ApiError, req: Request, res: Response, next: NextFunction): void {
  // If response was already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(err);
  }

  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';

  // Set default values
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let code = err.code || 'INTERNAL_ERROR';
  let details = err.details;

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = err.details || err.message;
  } else if (err.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_ID';
    message = 'Invalid ID format';
  } else if (err.name === 'MongoError' || err.name === 'MongoServerError') {
    if (err.code === 11000) {
      statusCode = 409;
      code = 'DUPLICATE_ENTRY';
      message = 'Duplicate entry';
      details = err.details;
    } else {
      statusCode = 500;
      code = 'DATABASE_ERROR';
      message = 'Database operation failed';
    }
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Invalid authentication token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Authentication token expired';
  } else if (err.name === 'MulterError') {
    statusCode = 400;
    code = 'FILE_UPLOAD_ERROR';
    message = 'File upload failed';
    details = err.message;
  }

  // Log error (but not in test environment)
  if (process.env.NODE_ENV !== 'test') {
    const logLevel = statusCode >= 500 ? 'error' : 'warn';
    const logMessage = `${req.method} ${req.originalUrl} - ${statusCode} - ${message}`;
    
    if (logLevel === 'error') {
      logger.error(logMessage, {
        error: {
          name: err.name,
          message: err.message,
          stack: err.stack,
          code: err.code,
          details: err.details
        },
        request: {
          method: req.method,
          url: req.originalUrl,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          headers: isDevelopment ? req.headers : undefined
        }
      });
    } else {
      logger.warn(logMessage, {
        error: { message: err.message, code: err.code },
        request: { method: req.method, url: req.originalUrl, ip: req.ip }
      });
    }
  }

  // Prepare error response
  const errorResponse: any = {
    success: false,
    error: {
      code,
      message,
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      method: req.method
    }
  };

  // Add additional details in development
  if (isDevelopment && !isProduction) {
    errorResponse.error.stack = err.stack;
    errorResponse.error.details = details;
  } else if (details && (statusCode < 500 || err.isOperational)) {
    // Only include details for client errors or operational errors
    errorResponse.error.details = details;
  }

  // Add retry information for rate limiting
  if (statusCode === 429 && details?.retryAfter) {
    res.set('Retry-After', details.retryAfter.toString());
    errorResponse.error.retryAfter = details.retryAfter;
  }

  // Add correlation ID if available
  const correlationId = req.headers['x-correlation-id'] || req.headers['x-request-id'];
  if (correlationId) {
    errorResponse.error.correlationId = correlationId;
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
}

// Async error handler wrapper
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    return Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// 404 handler for undefined routes
export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  const error = new NotFoundError(`Route ${req.originalUrl}`);
  next(error);
}

// Uncaught exception handler
export function setupUncaughtExceptionHandlers(): void {
  process.on('uncaughtException', (err: Error) => {
    logger.error('Uncaught Exception:', {
      error: {
        name: err.name,
        message: err.message,
        stack: err.stack
      }
    });

    // Graceful shutdown
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Rejection:', {
      reason: reason?.message || reason,
      stack: reason?.stack,
      promise: promise.toString()
    });

    // Graceful shutdown
    process.exit(1);
  });
}

// Error factory functions
export const createError = {
  validation: (message: string, details?: any) => new ValidationError(message, details),
  authentication: (message?: string) => new AuthenticationError(message),
  authorization: (message?: string) => new AuthorizationError(message),
  notFound: (resource?: string) => new NotFoundError(resource),
  conflict: (message: string, details?: any) => new ConflictError(message, details),
  rateLimit: (message?: string, retryAfter?: number) => new RateLimitError(message, retryAfter),
  serviceUnavailable: (message?: string) => new ServiceUnavailableError(message),
  custom: (message: string, statusCode: number, code?: string, details?: any) => 
    new CustomError(message, statusCode, code, details)
};

// Middleware to catch and format Joi validation errors
export function joiErrorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  if (err.isJoi) {
    const validationError = new ValidationError(
      'Validation failed',
      err.details.map((detail: any) => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }))
    );
    return next(validationError);
  }
  next(err);
}

// Timeout handler
export function timeoutHandler(timeoutMs: number = 30000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.setTimeout(timeoutMs, () => {
      const error = new CustomError(
        'Request timeout',
        408,
        'REQUEST_TIMEOUT',
        { timeout: timeoutMs }
      );
      next(error);
    });
    next();
  };
}