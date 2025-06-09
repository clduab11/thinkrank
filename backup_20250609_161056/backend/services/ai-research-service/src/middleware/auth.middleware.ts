import { createClient } from '@supabase/supabase-js';
import { NextFunction, Request, Response } from 'express';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Authentication middleware for AI research service
 */
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Skip auth for health checks
    if (req.path.startsWith('/health')) {
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_REQUIRED',
          message: 'Authentication token required'
        },
        meta: {
          timestamp: new Date().toISOString(),
          request_id: req.requestId,
          version: '1.0.0'
        }
      });
    }

    const token = authHeader.split(' ')[1];

    // Verify JWT token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
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

    // Attach user information to request
    req.user = {
      id: user.id,
      email: user.email!,
      role: user.user_metadata?.role || 'user'
    };

    next();
  } catch (error) {
    req.logger?.error('Authentication middleware error', {}, error as Error);

    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_FAILED',
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

/**
 * Optional authentication middleware (doesn't throw on missing auth)
 */
export const optionalAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];

      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (!error && user) {
        req.user = {
          id: user.id,
          email: user.email!,
          role: user.user_metadata?.role || 'user'
        };
      }
    }

    next();
  } catch (error) {
    // Continue without authentication for optional middleware
    next();
  }
};
