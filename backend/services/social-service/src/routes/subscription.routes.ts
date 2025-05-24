import { Router } from 'express';
import { subscriptionController } from '../controllers/subscription.controller';
import { requireFeature } from '../middleware/subscription.middleware';

const router = Router();

// Get subscription plans
router.get('/plans', subscriptionController.getPlans);
router.get('/plans/:tier', subscriptionController.getPlansByTier);

// User subscription management
router.get('/current', subscriptionController.getCurrentSubscription);
router.get('/usage', subscriptionController.getUsageStats);

// Subscription operations
router.post('/create', subscriptionController.createSubscription);
router.post('/upgrade', subscriptionController.upgradeSubscription);
router.post('/downgrade', subscriptionController.downgradeSubscription);
router.post('/cancel', subscriptionController.cancelSubscription);

// Premium/Pro feature access validation
router.get('/validate-feature/:feature', requireFeature('hasSocialSharing'), subscriptionController.validateFeatureAccess);

export { router as subscriptionRoutes };
