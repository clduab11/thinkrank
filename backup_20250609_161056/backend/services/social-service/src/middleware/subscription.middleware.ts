import { logger } from '@thinkrank/shared';
import { NextFunction, Response } from 'express';
import { AuthenticatedRequest } from './auth.middleware';

export interface SubscriptionFeatures {
  dailyProblemsLimit: number;
  hasAdsRemoved: boolean;
  hasSocialSharing: boolean;
  hasProgressAnalytics: boolean;
  hasForumAccess: boolean;
  hasVotingRights: boolean;
  hasEarlyAccess: boolean;
  hasCoAuthorshipEligibility: boolean;
  hasDirectInstitutionContact: boolean;
  hasCustomChallenges: boolean;
  hasAdvancedAnalytics: boolean;
}

const TIER_FEATURES: Record<string, SubscriptionFeatures> = {
  free: {
    dailyProblemsLimit: 3,
    hasAdsRemoved: false,
    hasSocialSharing: false,
    hasProgressAnalytics: false,
    hasForumAccess: false,
    hasVotingRights: false,
    hasEarlyAccess: false,
    hasCoAuthorshipEligibility: false,
    hasDirectInstitutionContact: false,
    hasCustomChallenges: false,
    hasAdvancedAnalytics: false
  },
  premium: {
    dailyProblemsLimit: -1, // unlimited
    hasAdsRemoved: true,
    hasSocialSharing: true,
    hasProgressAnalytics: true,
    hasForumAccess: true,
    hasVotingRights: false,
    hasEarlyAccess: false,
    hasCoAuthorshipEligibility: false,
    hasDirectInstitutionContact: false,
    hasCustomChallenges: false,
    hasAdvancedAnalytics: false
  },
  pro: {
    dailyProblemsLimit: -1, // unlimited
    hasAdsRemoved: true,
    hasSocialSharing: true,
    hasProgressAnalytics: true,
    hasForumAccess: true,
    hasVotingRights: true,
    hasEarlyAccess: true,
    hasCoAuthorshipEligibility: true,
    hasDirectInstitutionContact: true,
    hasCustomChallenges: true,
    hasAdvancedAnalytics: true
  }
};

export interface RequestWithSubscription extends AuthenticatedRequest {
  subscriptionFeatures?: SubscriptionFeatures;
}

export const subscriptionMiddleware = (
  req: RequestWithSubscription,
  res: Response,
  next: NextFunction
): void => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    const userTier = req.user.subscription_tier || 'free';
    const features = TIER_FEATURES[userTier];

    if (!features) {
      logger.error('Unknown subscription tier', {
        userId: req.user.id,
        tier: userTier
      });
      res.status(500).json({
        success: false,
        error: 'Invalid subscription configuration'
      });
      return;
    }

    req.subscriptionFeatures = features;

    logger.debug('Subscription features attached', {
      userId: req.user.id,
      tier: userTier,
      features
    });

    next();
  } catch (error) {
    logger.error('Subscription middleware error', { error });
    res.status(500).json({
      success: false,
      error: 'Subscription service error'
    });
  }
};

export const requireFeature = (featureName: keyof SubscriptionFeatures) => {
  return (req: RequestWithSubscription, res: Response, next: NextFunction): void => {
    if (!req.subscriptionFeatures) {
      res.status(500).json({
        success: false,
        error: 'Subscription features not initialized'
      });
      return;
    }

    const hasFeature = req.subscriptionFeatures[featureName];

    if (!hasFeature) {
      res.status(403).json({
        success: false,
        error: `Feature '${featureName}' requires subscription upgrade`,
        requiredTier: getMinimumTierForFeature(featureName)
      });
      return;
    }

    next();
  };
};

function getMinimumTierForFeature(featureName: keyof SubscriptionFeatures): string {
  for (const [tier, features] of Object.entries(TIER_FEATURES)) {
    if (features[featureName]) {
      return tier;
    }
  }
  return 'pro'; // Default to highest tier if feature not found
}
