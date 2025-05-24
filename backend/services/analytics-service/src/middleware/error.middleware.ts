import { NextFunction, Request, Response } from 'express';
import { logger } from '../services/logger.service';

export interface CustomError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

export const errorHandler = (
  error: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log the error
  logger.error('Error occurred', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    statusCode: error.statusCode || 500,
    code: error.code,
    details: error.details
  });

  // Default error response
  const statusCode = error.statusCode || 500;
  const message = statusCode === 500 ? 'Internal Server Error' : error.message;

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      code: error.code,
      ...(process.env.NODE_ENV === 'development' && {
        stack: error.stack,
        details: error.details
      })
    },
    timestamp: new Date().toISOString(),
    path: req.url,
    method: req.method
  });
};

// Error factory functions
export const createError = (
  message: string,
  statusCode: number = 500,
  code?: string,
  details?: any
): CustomError => {
  const error = new Error(message) as CustomError;
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
};

export const createValidationError = (details: any): CustomError => {
  return createError('Validation failed', 400, 'VALIDATION_ERROR', details);
};

export const createNotFoundError = (resource: string): CustomError => {
  return createError(`${resource} not found`, 404, 'NOT_FOUND');
};

export const createUnauthorizedError = (): CustomError => {
  return createError('Unauthorized', 401, 'UNAUTHORIZED');
};

export const createForbiddenError = (): CustomError => {
  return createError('Forbidden', 403, 'FORBIDDEN');
};

export const createConflictError = (message: string): CustomError => {
  return createError(message, 409, 'CONFLICT');
};

export const createRateLimitError = (): CustomError => {
  return createError('Too many requests', 429, 'RATE_LIMIT');
};
