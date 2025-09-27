import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import * as validator from 'validator';

/**
 * SecurityMiddleware enforces comprehensive request security
 * Implements rate limiting, input validation, and security headers
 */
@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  private readonly rateLimitConfig: {
    windowMs: number;
    max: number;
    message: string;
    standardHeaders: boolean;
    legacyHeaders: boolean;
  };

  private readonly securityHeaders: {
    corsOrigin: string;
    cspDirectives: string;
    hstsMaxAge: number;
  };

  constructor(private readonly configService: ConfigService) {
    // Environment-abstracted configuration
    this.rateLimitConfig = {
      windowMs: this.configService.get<number>('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000), // 15 minutes
      max: this.configService.get<number>('RATE_LIMIT_MAX_REQUESTS', 100),
      message: {
        error: 'Too many requests, please try again later.',
        retryAfter: null as number | null
      },
      standardHeaders: true,
      legacyHeaders: false
    };

    this.securityHeaders = {
      corsOrigin: this.configService.get<string>('CORS_ORIGIN', 'https://thinkrank.com'),
      cspDirectives: this.configService.get<string>(
        'CSP_DIRECTIVES',
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';"
      ),
      hstsMaxAge: this.configService.get<number>('HSTS_MAX_AGE', 31536000)
    };
  }

  /**
   * Main middleware function implementing comprehensive security
   * @param req Express request object
   * @param res Express response object
   * @param next Next function
   */
  use(req: Request, res: Response, next: NextFunction): void {
    // Apply security headers
    this.applySecurityHeaders(res);

    // Validate request
    if (!this.validateRequest(req, res)) {
      return;
    }

    // Apply rate limiting
    this.applyRateLimiting(req, res, next);
  }

  /**
   * Applies comprehensive security headers
   * @param res Express response object
   */
  private applySecurityHeaders(res: Response): void {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', this.securityHeaders.corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

    // Content Security Policy
    res.setHeader('Content-Security-Policy', this.securityHeaders.cspDirectives);

    // HSTS for HTTPS
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
      res.setHeader('Strict-Transport-Security', `max-age=${this.securityHeaders.hstsMaxAge}; includeSubDomains; preload`);
    }

    // Remove server information
    res.removeHeader('X-Powered-By');
  }

  /**
   * Validates incoming request for security threats
   * @param req Express request object
   * @param res Express response object
   * @returns boolean True if request is valid
   */
  private validateRequest(req: Request, res: Response): boolean {
    // Check request size
    if (!this.validateRequestSize(req)) {
      this.sendErrorResponse(res, 413, 'Request too large');
      return false;
    }

    // Validate headers
    if (!this.validateHeaders(req)) {
      this.sendErrorResponse(res, 400, 'Invalid headers');
      return false;
    }

    // Validate and sanitize input
    if (!this.validateAndSanitizeInput(req)) {
      this.sendErrorResponse(res, 400, 'Invalid input data');
      return false;
    }

    // Check for SQL injection attempts
    if (this.detectSqlInjection(req)) {
      this.sendErrorResponse(res, 403, 'Potential SQL injection detected');
      return false;
    }

    // Check for XSS attempts
    if (this.detectXssAttempt(req)) {
      this.sendErrorResponse(res, 403, 'Potential XSS attack detected');
      return false;
    }

    return true;
  }

  /**
   * Validates request size limits
   * @param req Express request object
   * @returns boolean True if size is within limits
   */
  private validateRequestSize(req: Request): boolean {
    const maxSize = 1024 * 1024; // 1MB limit
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);

    return contentLength <= maxSize;
  }

  /**
   * Validates security of request headers
   * @param req Express request object
   * @returns boolean True if headers are valid
   */
  private validateHeaders(req: Request): boolean {
    // Check for suspicious user agents
    const userAgent = req.headers['user-agent'] || '';
    if (userAgent.length > 500 || this.containsSuspiciousPatterns(userAgent)) {
      return false;
    }

    // Validate content type
    const contentType = req.headers['content-type'];
    if (contentType && !this.isValidContentType(contentType)) {
      return false;
    }

    return true;
  }

  /**
   * Validates and sanitizes input data
   * @param req Express request object
   * @returns boolean True if input is valid
   */
  private validateAndSanitizeInput(req: Request): boolean {
    try {
      // Sanitize query parameters
      if (req.query && typeof req.query === 'object') {
        for (const [key, value] of Object.entries(req.query)) {
          if (typeof value === 'string') {
            req.query[key] = validator.escape(value);
          }
        }
      }

      // Sanitize body if it's an object
      if (req.body && typeof req.body === 'object') {
        req.body = this.sanitizeObject(req.body);
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Recursively sanitizes object properties
   * @param obj Object to sanitize
   * @returns Sanitized object
   */
  private sanitizeObject(obj: any): any {
    if (typeof obj === 'string') {
      return validator.escape(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = this.sanitizeObject(value);
      }
      return sanitized;
    }

    return obj;
  }

  /**
   * Detects potential SQL injection patterns
   * @param req Express request object
   * @returns boolean True if SQL injection patterns detected
   */
  private detectSqlInjection(req: Request): boolean {
    const sqlPatterns = [
      /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/i,
      /(--|#|\/\*|\*\/)/,
      /(\bor\b\s+\d+\s*=\s*\d+)/i,
      /(\band\b\s+\d+\s*=\s*\d+)/i,
      /('|(\\')|(;)|(\|\|)/
    ];

    const checkValue = (value: any): boolean => {
      if (typeof value === 'string') {
        return sqlPatterns.some(pattern => pattern.test(value));
      }
      if (typeof value === 'object' && value !== null) {
        return Object.values(value).some(checkValue);
      }
      return false;
    };

    return checkValue(req.query) || checkValue(req.body);
  }

  /**
   * Detects potential XSS attempts
   * @param req Express request object
   * @returns boolean True if XSS patterns detected
   */
  private detectXssAttempt(req: Request): boolean {
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe\b[^>]*>/gi,
      /<object\b[^>]*>/gi,
      /<embed\b[^>]*>/gi,
      /<link\b[^>]*>/gi,
      /<meta\b[^>]*>/gi
    ];

    const checkValue = (value: any): boolean => {
      if (typeof value === 'string') {
        return xssPatterns.some(pattern => pattern.test(value));
      }
      if (typeof value === 'object' && value !== null) {
        return Object.values(value).some(checkValue);
      }
      return false;
    };

    return checkValue(req.query) || checkValue(req.body);
  }

  /**
   * Checks for suspicious patterns in strings
   * @param input String to check
   * @returns boolean True if suspicious patterns found
   */
  private containsSuspiciousPatterns(input: string): boolean {
    const suspiciousPatterns = [
      /<[^>]*>/g, // HTML tags
      /javascript:/gi, // JavaScript protocol
      /vbscript:/gi, // VBScript protocol
      /data:(?!image\/(?:png|jpg|jpeg|gif|webp|svg\+xml))[^,]/gi // Data URLs (excluding safe images)
    ];

    return suspiciousPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Validates content type header
   * @param contentType Content type string
   * @returns boolean True if content type is valid
   */
  private isValidContentType(contentType: string): boolean {
    const allowedTypes = [
      'application/json',
      'application/x-www-form-urlencoded',
      'multipart/form-data',
      'text/plain'
    ];

    return allowedTypes.some(type => contentType.toLowerCase().includes(type));
  }

  /**
   * Sends error response
   * @param res Express response object
   * @param statusCode HTTP status code
   * @param message Error message
   */
  private sendErrorResponse(res: Response, statusCode: number, message: string): void {
    res.status(statusCode).json({
      error: message,
      timestamp: new Date().toISOString(),
      path: res.req?.url || 'unknown'
    });
  }

  /**
   * Creates rate limiting middleware
   * @param req Express request object
   * @param res Express response object
   * @param next Next function
   */
  private applyRateLimiting(req: Request, res: Response, next: NextFunction): void {
    const rateLimiter = rateLimit({
      windowMs: this.rateLimitConfig.windowMs,
      max: this.rateLimitConfig.max,
      message: this.rateLimitConfig.message,
      standardHeaders: this.rateLimitConfig.standardHeaders,
      legacyHeaders: this.rateLimitConfig.legacyHeaders,
      handler: (req, res) => {
        const retryAfter = Math.ceil(this.rateLimitConfig.windowMs / 1000);
        res.setHeader('Retry-After', retryAfter.toString());
        res.status(429).json({
          error: 'Too many requests',
          retryAfter,
          message: 'Please try again later'
        });
      }
    });

    rateLimiter(req, res, next);
  }
}