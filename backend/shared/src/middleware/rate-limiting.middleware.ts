// Global Rate Limiting Middleware with Redis and DDoS Protection
import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { Logger } from '../utils/logger';

const logger = new Logger({ name: 'RateLimiter' });

// Rate limiting configuration
interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  message?: string;
  statusCode?: number;
}

// Advanced rate limiting with multiple strategies
export class AdvancedRateLimiter {
  private redis: Redis;
  private configs: Map<string, RateLimitConfig> = new Map();
  private abuseDetection: AbuseDetectionSystem;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
    this.abuseDetection = new AbuseDetectionSystem(this.redis);
    this.setupDefaultConfigs();
  }

  private setupDefaultConfigs() {
    // Global rate limit
    this.addConfig('global', {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 1000,
      message: 'Too many requests from this IP, please try again later'
    });

    // Auth endpoints - stricter limits
    this.addConfig('auth', {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 20,
      message: 'Too many authentication attempts, please try again later'
    });

    // API endpoints
    this.addConfig('api', {
      windowMs: 1 * 60 * 1000, // 1 minute
      maxRequests: 100,
      message: 'API rate limit exceeded'
    });

    // Gaming endpoints
    this.addConfig('game', {
      windowMs: 1 * 60 * 1000, // 1 minute
      maxRequests: 200,
      message: 'Game API rate limit exceeded'
    });

    // Password reset - very strict
    this.addConfig('password-reset', {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 3,
      message: 'Too many password reset attempts'
    });
  }

  public addConfig(name: string, config: RateLimitConfig) {
    this.configs.set(name, config);
  }

  public createMiddleware(configName: string = 'global') {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const config = this.configs.get(configName);
        if (!config) {
          logger.warn(`Rate limit config '${configName}' not found, using global`);
          return this.createMiddleware('global')(req, res, next);
        }

        const key = config.keyGenerator ? config.keyGenerator(req) : this.getDefaultKey(req, configName);
        const currentTime = Date.now();
        const windowStart = currentTime - config.windowMs;

        // Check for abuse patterns
        const isAbusive = await this.abuseDetection.checkForAbuse(req, key);
        if (isAbusive) {
          logger.warn('Abusive behavior detected', { ip: req.ip, key, userAgent: req.get('User-Agent') });
          return res.status(429).json({
            error: 'Suspicious activity detected. Please contact support.',
            code: 'ABUSE_DETECTED'
          });
        }

        // Sliding window rate limiting
        const pipeline = this.redis.pipeline();
        pipeline.zremrangebyscore(key, 0, windowStart);
        pipeline.zcard(key);
        pipeline.zadd(key, currentTime, `${currentTime}-${Math.random()}`);
        pipeline.expire(key, Math.ceil(config.windowMs / 1000));

        const results = await pipeline.exec();
        if (!results) {
          throw new Error('Redis pipeline execution failed');
        }

        const requestCount = (results[1][1] as number) || 0;

        // Check if rate limit exceeded
        if (requestCount >= config.maxRequests) {
          // Log rate limit exceeded
          logger.warn('Rate limit exceeded', {
            ip: req.ip,
            key,
            configName,
            requestCount,
            maxRequests: config.maxRequests,
            userAgent: req.get('User-Agent')
          });

          // Add to abuse tracking
          await this.abuseDetection.recordRateLimitViolation(req, key);

          return res.status(config.statusCode || 429).json({
            error: config.message || 'Rate limit exceeded',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: Math.ceil(config.windowMs / 1000)
          });
        }

        // Add rate limit headers
        res.set({
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': (config.maxRequests - requestCount - 1).toString(),
          'X-RateLimit-Reset': new Date(currentTime + config.windowMs).toISOString()
        });

        next();
      } catch (error) {
        logger.error('Rate limiting error', { error: error.message, stack: error.stack });
        // Fail open on rate limiter errors to avoid blocking legitimate traffic
        next();
      }
    };
  }

  private getDefaultKey(req: Request, configName: string): string {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userId = req.headers['x-user-id'] || 'anonymous';
    return `rate_limit:${configName}:${ip}:${userId}`;
  }
}

// Abuse Detection System
class AbuseDetectionSystem {
  private redis: Redis;
  private suspiciousPatterns = new Set([
    'sqlmap', 'nmap', 'nikto', 'burp', 'owasp', 'scanner', 'crawler'
  ]);

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async checkForAbuse(req: Request, key: string): Promise<boolean> {
    const checks = await Promise.all([
      this.checkUserAgentSuspicious(req),
      this.checkRepeatedRateLimitViolations(key),
      this.checkRequestPatterns(req),
      this.checkGeographicAnomalies(req)
    ]);

    return checks.some(check => check);
  }

  private async checkUserAgentSuspicious(req: Request): Promise<boolean> {
    const userAgent = (req.get('User-Agent') || '').toLowerCase();
    return this.suspiciousPatterns.has(userAgent) || 
           userAgent.includes('bot') || 
           userAgent.includes('scan') ||
           userAgent === '';
  }

  private async checkRepeatedRateLimitViolations(key: string): Promise<boolean> {
    const violationKey = `violations:${key}`;
    const violations = await this.redis.get(violationKey);
    return violations && parseInt(violations) > 5;
  }

  private async checkRequestPatterns(req: Request): Promise<boolean> {
    // Check for common attack patterns in URL
    const suspiciousPathPatterns = [
      'admin', 'wp-admin', 'phpmyadmin', 'config', 'backup',
      'sql', 'exec', 'cmd', 'shell', 'exploit'
    ];
    
    const path = req.path.toLowerCase();
    return suspiciousPathPatterns.some(pattern => path.includes(pattern));
  }

  private async checkGeographicAnomalies(req: Request): Promise<boolean> {
    // This would integrate with a GeoIP service
    // For now, just check for missing or suspicious headers
    const headers = req.headers;
    return !headers['accept-language'] || !headers['accept-encoding'];
  }

  async recordRateLimitViolation(req: Request, key: string): Promise<void> {
    const violationKey = `violations:${key}`;
    await this.redis.incr(violationKey);
    await this.redis.expire(violationKey, 24 * 60 * 60); // 24 hours

    // Log violation for analysis
    logger.warn('Rate limit violation recorded', {
      key,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method
    });
  }
}

// DDoS Protection Middleware
export class DDoSProtection {
  private redis: Redis;
  private circuitBreaker: Map<string, { failures: number; lastFailure: number; state: 'open' | 'closed' | 'half-open' }> = new Map();

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
  }

  public createMiddleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const ip = req.ip || req.connection.remoteAddress || 'unknown';
        
        // Check circuit breaker for this IP
        const breaker = this.circuitBreaker.get(ip);
        if (breaker && breaker.state === 'open') {
          const timeSinceLastFailure = Date.now() - breaker.lastFailure;
          if (timeSinceLastFailure < 60000) { // 1 minute circuit breaker
            return res.status(503).json({
              error: 'Service temporarily unavailable',
              code: 'CIRCUIT_BREAKER_OPEN'
            });
          } else {
            breaker.state = 'half-open';
          }
        }

        // Monitor request patterns
        await this.monitorRequestPatterns(req);

        next();
      } catch (error) {
        logger.error('DDoS protection error', { error: error.message });
        next();
      }
    };
  }

  private async monitorRequestPatterns(req: Request): Promise<void> {
    const ip = req.ip || 'unknown';
    const windowKey = `ddos:${ip}:${Math.floor(Date.now() / 10000)}`; // 10 second windows
    
    const requestCount = await this.redis.incr(windowKey);
    await this.redis.expire(windowKey, 60); // Keep for 1 minute

    // Trigger circuit breaker if too many requests
    if (requestCount > 100) { // 100 requests per 10 seconds
      this.circuitBreaker.set(ip, {
        failures: (this.circuitBreaker.get(ip)?.failures || 0) + 1,
        lastFailure: Date.now(),
        state: 'open'
      });
      
      logger.warn('DDoS protection triggered', { ip, requestCount });
    }
  }
}

// Factory function for easy integration
export function createRateLimitMiddleware(redisUrl: string, configName: string = 'global') {
  const rateLimiter = new AdvancedRateLimiter(redisUrl);
  return rateLimiter.createMiddleware(configName);
}

export function createDDoSProtection(redisUrl: string) {
  const ddosProtection = new DDoSProtection(redisUrl);
  return ddosProtection.createMiddleware();
}