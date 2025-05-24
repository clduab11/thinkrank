import { createClient } from '@supabase/supabase-js';
import { logger } from '@thinkrank/shared';
import { NextFunction, Request, Response } from 'express';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    subscription_tier: 'free' | 'premium' | 'pro';
  };
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'No valid authorization token provided'
      });
      return;
    }

    const token = authHeader.substring(7);

    // Verify JWT token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      logger.warn('Invalid token provided', { error: error?.message });
      res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
      return;
    }

    // Fetch user details including subscription tier
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, subscription_tier')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      logger.error('Failed to fetch user data', {
        userId: user.id,
        error: userError?.message
      });
      res.status(500).json({
        success: false,
        error: 'Failed to authenticate user'
      });
      return;
    }

    // Attach user to request
    req.user = userData;

    logger.debug('User authenticated', {
      userId: userData.id,
      tier: userData.subscription_tier
    });

    next();
  } catch (error) {
    logger.error('Authentication middleware error', { error });
    res.status(500).json({
      success: false,
      error: 'Authentication service error'
    });
  }
};
