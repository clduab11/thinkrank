// Request middleware for authentication service
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
    }
  }
}

// Request context middleware - adds request ID and logger
export const requestMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Generate unique request ID
  req.requestId = (req.headers['x-request-id'] as string) || uuidv4();
  req.startTime = Date.now();

  // Create request-scoped logger
  req.logger = Logger.getInstance('auth-service')
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
  res.end = function(chunk?: Buffer | string, encoding?: BufferEncoding) {
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

// Authentication middleware - verifies JWT tokens
export const authMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Authentication token is required'
        },
        meta: {
          timestamp: new Date().toISOString(),
          request_id: req.requestId,
          version: '1.0.0'
        }
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // TODO: Verify JWT token with Supabase
    // For now, just validate format
    if (!token || token.length < 10) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid authentication token'
        },
        meta: {
          timestamp: new Date().toISOString(),
          request_id: req.requestId,
          version: '1.0.0'
        }
      });
    }

    // TODO: Add user information to request object
    // req.user = decodedToken.user;

    next();
  } catch (error) {
    req.logger.error('Authentication middleware error', {}, error as Error);

    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'Authentication failed'
      },
      meta: {
        timestamp: new Date().toISOString(),
        request_id: req.requestId,
        version: '1.0.0'
      }
    });
  }
};

// Rate limiting by user ID
export const userRateLimitMiddleware = (maxRequests: number = 60, windowMs: number = 60000) => {
  const requestCounts = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const userId = req.headers['x-user-id'] as string || req.ip;
    const now = Date.now();

    // Clean up expired entries
    for (const [key, value] of requestCounts.entries()) {
      if (now > value.resetTime) {
        requestCounts.delete(key);
      }
    }

    const userRecord = requestCounts.get(userId);

    if (!userRecord) {
      requestCounts.set(userId, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (now > userRecord.resetTime) {
      requestCounts.set(userId, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (userRecord.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: {
          code: 'USER_RATE_LIMIT_EXCEEDED',
          message: `Too many requests. Maximum ${maxRequests} requests per ${windowMs / 1000} seconds`
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
