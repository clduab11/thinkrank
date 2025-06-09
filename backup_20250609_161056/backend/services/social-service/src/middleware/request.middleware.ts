import { logger } from '@thinkrank/shared';
import { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

export interface RequestWithContext extends Request {
  requestId: string;
  startTime: number;
}

export const requestMiddleware = (
  req: RequestWithContext,
  res: Response,
  next: NextFunction
): void => {
  // Add request ID for tracing
  req.requestId = uuidv4();
  req.startTime = Date.now();

  // Add request ID to response headers
  res.setHeader('X-Request-ID', req.requestId);

  // Log incoming request
  logger.info('Incoming request', {
    requestId: req.requestId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    logger.info('Request completed', {
      requestId: req.requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    });
  });

  next();
};
