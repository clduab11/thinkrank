import { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../services/logger.service';

export interface RequestWithId extends Request {
  id: string;
  startTime: number;
}

export const requestLogger = (req: RequestWithId, res: Response, next: NextFunction): void => {
  // Generate unique request ID
  req.id = uuidv4();
  req.startTime = Date.now();

  // Log incoming request
  logger.info('Incoming request', {
    requestId: req.id,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    headers: req.headers
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;

    logger.info('Request completed', {
      requestId: req.id,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      ip: req.ip
    });

    // Log slow requests
    if (duration > 1000) {
      logger.warn('Slow request detected', {
        requestId: req.id,
        method: req.method,
        url: req.url,
        duration
      });
    }
  });

  next();
};

// Security headers middleware
export const securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  res.setHeader('X-Request-ID', (req as RequestWithId).id || 'unknown');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
};

// Request size limiter
export const requestSizeLimiter = (maxSize: string = '10mb') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = req.get('content-length');
    if (contentLength && parseInt(contentLength) > parseSize(maxSize)) {
      res.status(413).json({
        success: false,
        error: {
          message: 'Request entity too large',
          code: 'REQUEST_TOO_LARGE'
        }
      });
      return;
    }
    next();
  };
};

// Helper function to parse size strings
const parseSize = (size: string): number => {
  const units = { b: 1, kb: 1024, mb: 1024 * 1024, gb: 1024 * 1024 * 1024 };
  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  const unit = (match[2] || 'b') as keyof typeof units;
  return value * units[unit];
};
