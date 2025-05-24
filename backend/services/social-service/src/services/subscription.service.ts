import { createClient } from '@supabase/supabase-js';
import { logger } from '@thinkrank/shared';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface Subscription {
  id: string;
  user_id: string;
  tier_type: 'free' | 'premium' | 'pro';
  start_date: string;
  end_date?: string;
  auto_renewal: boolean;
  stripe_subscription_id?: string;
  stripe_customer_id?: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete';
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  tier: 'free' | 'premium' | 'pro';
  description: string;
  price: number;
  currency: 'USD';
  billingPeriod: 'monthly' | 'yearly';
  features: string[];
  stripePriceId?: string;
}

export interface UsageStats {
  userId: string;
  currentPeriod: {
    startDate: string;
    endDate: string;
  };
  problemsSolved: number;
  dailyLimit: number;
  remaining: number;
  resetDate: string;
}

class SubscriptionService {
  private plans: SubscriptionPlan[] = [
    {
      id: 'free',
      name: 'AI Explorer',
      tier: 'free',
      description: 'Perfect for getting started with AI research',
      price: 0,
      currency: 'USD',
      billingPeriod: 'monthly',
      features: [
        '3 research problems per day',
        'Basic puzzle games',
        'AI education content',
        'Basic leaderboards',
        'Standard game assets'
      ]
    },
    {
      id: 'premium_monthly',
      name: 'AI Investigator',
      tier: 'premium',
      description: 'Enhanced experience for serious researchers',
      price: 9.99,
      currency: 'USD',
      billingPeriod: 'monthly',
      features: [
        'Unlimited daily research problems',
        'Ad-free gaming experience',
        'Full social media integration',
        'Detailed progress analytics',
        'Researcher forums access',
        'Community challenges',
        'Enhanced game assets'
      ],
      stripePriceId: process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID
    },
    {
      id: 'premium_yearly',
      name: 'AI Investigator (Yearly)',
      tier: 'premium',
      description: 'Enhanced experience with yearly savings',
      price: 99.99,
      currency: 'USD',
      billingPeriod: 'yearly',
      features: [
        'All Premium features',
        '2 months free with yearly billing'
      ],
      stripePriceId: process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID
    },
    {
      id: 'pro_monthly',
      name: 'AI Researcher',
      tier: 'pro',
      description: 'Full access for professional researchers',
      price: 29.99,
      currency: 'USD',
      billingPeriod: 'monthly',
      features: [
        'All Premium features',
        'Voting rights on research priorities',
        'Early access to new features',
        'Co-authorship eligibility',
        'Direct institution communication',
        'Custom challenge requests',
        'Advanced analytics'
      ],
      stripePriceId: process.env.STRIPE_PRO_MONTHLY_PRICE_ID
    },
    {
      id: 'pro_yearly',
      name: 'AI Researcher (Yearly)',
      tier: 'pro',
      description: 'Professional tier with yearly savings',
      price: 299.99,
      currency: 'USD',
      billingPeriod: 'yearly',
      features: [
        'All Pro features',
        '2 months free with yearly billing'
      ],
      stripePriceId: process.env.STRIPE_PRO_YEARLY_PRICE_ID
    }
  ];

  async getUserSubscription(userId: string): Promise<Subscription | null> {
    try {
      const { data: subscription, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        logger.error('Failed to fetch user subscription', { userId, error: error.message });
        return null;
      }

      return subscription || null;
    } catch (error) {
      logger.error('Error fetching user subscription', { userId, error });
      return null;
    }
  }

  async createSubscription(
    userId: string,
    planId: string,
    stripeSubscriptionId?: string,
    stripeCustomerId?: string
  ): Promise<Subscription | null> {
    try {
      const plan = this.plans.find(p => p.id === planId);
      if (!plan) {
        logger.error('Invalid plan ID', { planId });
        return null;
      }

      // Calculate end date
      const startDate = new Date();
      const endDate = new Date(startDate);
      if (plan.billingPeriod === 'yearly') {
        endDate.setFullYear(endDate.getFullYear() + 1);
      } else {
        endDate.setMonth(endDate.getMonth() + 1);
      }

      const subscriptionData = {
        user_id: userId,
        tier_type: plan.tier,
        start_date: startDate.toISOString(),
        end_date: plan.tier === 'free' ? null : endDate.toISOString(),
        auto_renewal: plan.tier !== 'free',
        stripe_subscription_id: stripeSubscriptionId,
        stripe_customer_id: stripeCustomerId,
        status: 'active' as const,
        metadata: {
          plan_id: planId,
          plan_name: plan.name,
          price: plan.price,
          billing_period: plan.billingPeriod
        }
      };

      const { data: subscription, error } = await supabase
        .from('subscriptions')
        .insert(subscriptionData)
        .select()
        .single();

      if (error) {
        logger.error('Failed to create subscription', { userId, planId, error: error.message });
        return null;
      }

      // Update user's subscription tier
      await this.updateUserTier(userId, plan.tier);

      logger.info('Subscription created', { userId, planId, subscriptionId: subscription.id });
      return subscription;

    } catch (error) {
      logger.error('Error creating subscription', { userId, planId, error });
      return null;
    }
  }

  async cancelSubscription(userId: string, reason?: string): Promise<boolean> {
    try {
      const subscription = await this.getUserSubscription(userId);
      if (!subscription) {
        logger.warn('No active subscription to cancel', { userId });
        return false;
      }

      const { error } = await supabase
        .from('subscriptions')
        .update({
          status: 'canceled',
          auto_renewal: false,
          metadata: {
            ...subscription.metadata,
            canceled_at: new Date().toISOString(),
            cancellation_reason: reason
          }
        })
        .eq('id', subscription.id);

      if (error) {
        logger.error('Failed to cancel subscription', { userId, subscriptionId: subscription.id, error: error.message });
        return false;
      }

      // Don't immediately downgrade - let them keep benefits until end date
      logger.info('Subscription canceled', { userId, subscriptionId: subscription.id, reason });
      return true;

    } catch (error) {
      logger.error('Error canceling subscription', { userId, error });
      return false;
    }
  }

  async upgradeSubscription(
    userId: string,
    newPlanId: string,
    stripeSubscriptionId?: string
  ): Promise<Subscription | null> {
    try {
      const currentSubscription = await this.getUserSubscription(userId);
      const newPlan = this.plans.find(p => p.id === newPlanId);

      if (!newPlan) {
        logger.error('Invalid new plan ID', { newPlanId });
        return null;
      }

      // Cancel current subscription if exists
      if (currentSubscription) {
        await this.cancelSubscription(userId, 'Upgraded to higher tier');
      }

      // Create new subscription
      return await this.createSubscription(
        userId,
        newPlanId,
        stripeSubscriptionId,
        currentSubscription?.stripe_customer_id
      );

    } catch (error) {
      logger.error('Error upgrading subscription', { userId, newPlanId, error });
      return null;
    }
  }

  async downgradeSubscription(userId: string, newPlanId: string): Promise<Subscription | null> {
    try {
      const currentSubscription = await this.getUserSubscription(userId);
      const newPlan = this.plans.find(p => p.id === newPlanId);

      if (!newPlan) {
        logger.error('Invalid new plan ID', { newPlanId });
        return null;
      }

      if (!currentSubscription) {
        logger.warn('No subscription to downgrade', { userId });
        return null;
      }

      // Schedule downgrade at end of current billing period
      const { error } = await supabase
        .from('subscriptions')
        .update({
          auto_renewal: false,
          metadata: {
            ...currentSubscription.metadata,
            scheduled_downgrade: {
              new_plan_id: newPlanId,
              scheduled_date: currentSubscription.end_date,
              reason: 'User requested downgrade'
            }
          }
        })
        .eq('id', currentSubscription.id);

      if (error) {
        logger.error('Failed to schedule downgrade', { userId, error: error.message });
        return null;
      }

      logger.info('Subscription downgrade scheduled', {
        userId,
        currentPlan: currentSubscription.metadata.plan_id,
        newPlan: newPlanId,
        effectiveDate: currentSubscription.end_date
      });

      return currentSubscription;

    } catch (error) {
      logger.error('Error scheduling downgrade', { userId, newPlanId, error });
      return null;
    }
  }

  async getUsageStats(userId: string): Promise<UsageStats | null> {
    try {
      const subscription = await this.getUserSubscription(userId);
      const tier = subscription?.tier_type || 'free';

      // Get current period dates
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const periodEnd = new Date(periodStart);
      periodEnd.setDate(periodEnd.getDate() + 1);

      // Get today's problem count
      const { count: problemsSolved, error } = await supabase
        .from('research_contributions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('submitted_at', periodStart.toISOString())
        .lt('submitted_at', periodEnd.toISOString());

      if (error) {
        logger.error('Failed to fetch usage stats', { userId, error: error.message });
        return null;
      }

      // Determine daily limit based on tier
      const dailyLimit = tier === 'free' ? 3 : -1; // -1 = unlimited
      const remaining = dailyLimit === -1 ? -1 : Math.max(0, dailyLimit - (problemsSolved || 0));

      // Reset date is start of next day
      const resetDate = new Date(periodEnd);

      return {
        userId,
        currentPeriod: {
          startDate: periodStart.toISOString(),
          endDate: periodEnd.toISOString()
        },
        problemsSolved: problemsSolved || 0,
        dailyLimit,
        remaining,
        resetDate: resetDate.toISOString()
      };

    } catch (error) {
      logger.error('Error getting usage stats', { userId, error });
      return null;
    }
  }

  async checkSubscriptionExpiry(): Promise<void> {
    try {
      // Find expired subscriptions
      const { data: expiredSubscriptions, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('status', 'active')
        .lt('end_date', new Date().toISOString());

      if (error) {
        logger.error('Failed to check expired subscriptions', { error: error.message });
        return;
      }

      for (const subscription of expiredSubscriptions || []) {
        // Check if there's a scheduled downgrade
        const scheduledDowngrade = subscription.metadata?.scheduled_downgrade;

        if (scheduledDowngrade) {
          // Execute downgrade
          await this.createSubscription(
            subscription.user_id,
            scheduledDowngrade.new_plan_id
          );
        } else {
          // Downgrade to free
          await this.updateUserTier(subscription.user_id, 'free');
        }

        // Mark subscription as expired
        await supabase
          .from('subscriptions')
          .update({ status: 'canceled' })
          .eq('id', subscription.id);

        logger.info('Subscription expired and processed', {
          userId: subscription.user_id,
          subscriptionId: subscription.id
        });
      }

    } catch (error) {
      logger.error('Error checking subscription expiry', { error });
    }
  }

  private async updateUserTier(userId: string, tier: 'free' | 'premium' | 'pro'): Promise<void> {
    const { error } = await supabase
      .from('users')
      .update({ subscription_tier: tier })
      .eq('id', userId);

    if (error) {
      logger.error('Failed to update user tier', { userId, tier, error: error.message });
    } else {
      logger.info('User tier updated', { userId, tier });
    }
  }

  getPlans(): SubscriptionPlan[] {
    return this.plans;
  }

  getPlanById(planId: string): SubscriptionPlan | undefined {
    return this.plans.find(p => p.id === planId);
  }

  getPlansByTier(tier: 'free' | 'premium' | 'pro'): SubscriptionPlan[] {
    return this.plans.filter(p => p.tier === tier);
  }
}

export const subscriptionService = new SubscriptionService();
