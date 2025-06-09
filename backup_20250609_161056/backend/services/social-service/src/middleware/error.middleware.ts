import { logger } from '@thinkrank/shared';
import { NextFunction, Request, Response } from 'express';

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  logger.error('Error occurred:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Don't expose internal errors in production
  const isProduction = process.env.NODE_ENV === 'production';

  if (error.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: isProduction ? undefined : error.message
    });
    return;
  }

  if (error.name === 'UnauthorizedError') {
    res.status(401).json({
      success: false,
      error: 'Unauthorized access'
    });
    return;
  }

  if (error.name === 'ForbiddenError') {
    res.status(403).json({
      success: false,
      error: 'Access forbidden'
    });
    return;
  }

  if (error.name === 'NotFoundError') {
    res.status(404).json({
      success: false,
      error: 'Resource not found'
    });
    return;
  }

  if (error.name === 'ConflictError') {
    res.status(409).json({
      success: false,
      error: 'Resource conflict'
    });
    return;
  }

  // Default server error
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    details: isProduction ? undefined : error.message
  });
};
