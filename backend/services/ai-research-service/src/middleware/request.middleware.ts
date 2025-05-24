// Request middleware for AI research service
import { Logger } from '@thinkrank/shared';
import { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      startTime: number;
      logger: Logger;
      user?: {
        id: string;
        email: string;
        role?: string;
      };
    }
  }
}

// Request context middleware - adds request ID and logger
export const requestMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Generate unique request ID
  req.requestId = (req.headers['x-request-id'] as string) || uuidv4();
  req.startTime = Date.now();

  // Create request-scoped logger
  req.logger = Logger.getInstance('ai-research-service')
    .setRequestId(req.requestId)
    .setContext({
      method: req.method,
      url: req.url,
      ip: req.ip,
      user_agent: req.headers['user-agent']
    });

  // Set response headers
  res.setHeader('X-Request-ID', req.requestId);
  res.setHeader('X-Response-Time', '0');

  // Log incoming request
  req.logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    user_agent: req.headers['user-agent']
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const duration = Date.now() - req.startTime;
    res.setHeader('X-Response-Time', `${duration}ms`);

    req.logger.info('Request completed', {
      status_code: res.statusCode,
      duration_ms: duration
    });

    originalEnd.call(this, chunk, encoding);
  };

  next();
};

// Research contribution rate limiting
export const contributionRateLimitMiddleware = (maxContributions: number = 10, windowMs: number = 60000) => {
  const contributionCounts = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const userId = req.user?.id || req.ip;
    const now = Date.now();

    // Clean up expired entries
    for (const [key, value] of contributionCounts.entries()) {
      if (now > value.resetTime) {
        contributionCounts.delete(key);
      }
    }

    const userRecord = contributionCounts.get(userId);

    if (!userRecord) {
      contributionCounts.set(userId, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (now > userRecord.resetTime) {
      contributionCounts.set(userId, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (userRecord.count >= maxContributions) {
      return res.status(429).json({
        success: false,
        error: {
          code: 'CONTRIBUTION_RATE_LIMIT_EXCEEDED',
          message: `Too many contributions. Maximum ${maxContributions} contributions per ${windowMs / 1000} seconds`
        },
        meta: {
          timestamp: new Date().toISOString(),
          request_id: req.requestId,
          version: '1.0.0'
        }
      });
    }

    userRecord.count++;
    next();
  };
};

// Request validation middleware
export const validateContentType = (contentType: string = 'application/json') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      if (!req.headers['content-type']?.includes(contentType)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_CONTENT_TYPE',
            message: `Content-Type must be ${contentType}`
          },
          meta: {
            timestamp: new Date().toISOString(),
            request_id: req.requestId,
            version: '1.0.0'
          }
        });
      }
    }
    next();
  };
};
