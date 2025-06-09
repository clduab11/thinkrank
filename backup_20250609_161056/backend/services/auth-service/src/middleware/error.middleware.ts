// Error handling middleware for authentication service
import { AppError, ErrorFormatter, ErrorHandler, isAppError } from '@thinkrank/shared';
import { NextFunction, Request, Response } from 'express';

// Global error handling middleware
export const errorMiddleware = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log the error
  req.logger.error('Request error occurred', {
    url: req.url,
    method: req.method,
    user_agent: req.headers['user-agent'],
    ip: req.ip
  }, error);

  // Handle known application errors
  if (isAppError(error)) {
    const statusCode = ErrorHandler.getStatusCode(error);
    const errorResponse = ErrorFormatter.format(error, req.requestId);

    return res.status(statusCode).json(errorResponse);
  }

  // Handle validation errors from Joi
  if (error.name === 'ValidationError') {
    const validationError = new AppError(
      'Validation failed',
      400,
      'VALIDATION_ERROR',
      true,
      { details: (error as any).details }
    );

    const errorResponse = ErrorFormatter.format(validationError, req.requestId);
    return res.status(400).json(errorResponse);
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    const jwtError = new AppError(
      'Invalid token',
      401,
      'INVALID_TOKEN',
      true
    );

    const errorResponse = ErrorFormatter.format(jwtError, req.requestId);
    return res.status(401).json(errorResponse);
  }

  if (error.name === 'TokenExpiredError') {
    const expiredError = new AppError(
      'Token has expired',
      401,
      'TOKEN_EXPIRED',
      true
    );

    const errorResponse = ErrorFormatter.format(expiredError, req.requestId);
    return res.status(401).json(errorResponse);
  }

  // Handle Supabase errors
  if ((error as any).code) {
    const supabaseError = ErrorHandler.fromSupabaseError(error);
    const statusCode = ErrorHandler.getStatusCode(supabaseError);
    const errorResponse = ErrorFormatter.format(supabaseError, req.requestId);

    return res.status(statusCode).json(errorResponse);
  }

  // Handle syntax errors (malformed JSON)
  if (error instanceof SyntaxError && 'body' in error) {
    const syntaxError = new AppError(
      'Invalid JSON format',
      400,
      'INVALID_JSON',
      true
    );

    const errorResponse = ErrorFormatter.format(syntaxError, req.requestId);
    return res.status(400).json(errorResponse);
  }

  // Handle unexpected errors (programming errors)
  req.logger.error('Unexpected error occurred', {
    stack: error.stack,
    name: error.name,
    message: error.message
  });

  // Don't expose internal error details in production
  const isProduction = process.env.NODE_ENV === 'production';
  const errorResponse = isProduction
    ? ErrorFormatter.formatUnexpectedError(req.requestId)
    : ErrorFormatter.format(
        new AppError(error.message, 500, 'INTERNAL_ERROR', false),
        req.requestId
      );

  res.status(500).json(errorResponse);
};

// 404 Not Found middleware
export const notFoundMiddleware = (req: Request, res: Response): void => {
  const error = new AppError(
    `Route ${req.method} ${req.path} not found`,
    404,
    'ROUTE_NOT_FOUND',
    true,
    {
      method: req.method,
      path: req.path
    }
  );

  const errorResponse = ErrorFormatter.format(error, req.requestId);
  res.status(404).json(errorResponse);
};

// Async error handler wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Validation error handler
export const handleValidationError = (error: any, req: Request): AppError => {
  if (error.isJoi) {
    const details = error.details.map((detail: any) => ({
      field: detail.path.join('.'),
      message: detail.message,
      code: detail.type
    }));

    return new AppError(
      'Validation failed',
      400,
      'VALIDATION_ERROR',
      true,
      { validation_errors: details }
    );
  }

  return new AppError(error.message, 400, 'VALIDATION_ERROR');
};

// Database error handler
export const handleDatabaseError = (error: any, req: Request): AppError => {
  req.logger.error('Database error occurred', {
    code: error.code,
    message: error.message,
    detail: error.detail
  });

  // Map common PostgreSQL error codes
  switch (error.code) {
    case '23505': // unique_violation
      return new AppError(
        'Resource already exists',
        409,
        'DUPLICATE_RESOURCE',
        true,
        { constraint: error.constraint }
      );

    case '23503': // foreign_key_violation
      return new AppError(
        'Referenced resource does not exist',
        400,
        'FOREIGN_KEY_VIOLATION',
        true,
        { constraint: error.constraint }
      );

    case '23502': // not_null_violation
      return new AppError(
        'Required field is missing',
        400,
        'NOT_NULL_VIOLATION',
        true,
        { column: error.column }
      );

    case '42501': // insufficient_privilege
      return new AppError(
        'Insufficient privileges',
        403,
        'INSUFFICIENT_PRIVILEGES',
        true
      );

    default:
      return new AppError(
        'Database operation failed',
        500,
        'DATABASE_ERROR',
        false,
        { code: error.code }
      );
  }
};
