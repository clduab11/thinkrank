import { createClient } from '@supabase/supabase-js';
import { logger } from '@thinkrank/shared';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface SocialInteraction {
  id: string;
  user_id: string;
  target_user_id?: string;
  interaction_type: 'like' | 'comment' | 'share' | 'follow';
  target_type: string;
  target_id: string;
  content?: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface UserProfile {
  id: string;
  username: string;
  profile_data: {
    displayName?: string;
    avatar?: string;
    bio?: string;
    achievements?: string[];
    stats?: {
      totalScore: number;
      level: number;
      contributionsCount: number;
      followersCount: number;
      followingCount: number;
    };
  };
}

export interface FriendConnection {
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted' | 'blocked';
  created_at: string;
}

class SocialService {

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, username, profile_data')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        logger.error('Failed to fetch user profile', { userId, error: userError?.message });
        return null;
      }

      // Get game progress for stats
      const { data: progress } = await supabase
        .from('game_progress')
        .select('level, total_score, achievements')
        .eq('user_id', userId)
        .single();

      // Count contributions
      const { count: contributionsCount } = await supabase
        .from('research_contributions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      // Count followers
      const { count: followersCount } = await supabase
        .from('social_interactions')
        .select('*', { count: 'exact', head: true })
        .eq('target_user_id', userId)
        .eq('interaction_type', 'follow');

      // Count following
      const { count: followingCount } = await supabase
        .from('social_interactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('interaction_type', 'follow');

      return {
        id: user.id,
        username: user.username,
        profile_data: {
          ...user.profile_data,
          stats: {
            totalScore: progress?.total_score || 0,
            level: progress?.level || 1,
            contributionsCount: contributionsCount || 0,
            followersCount: followersCount || 0,
            followingCount: followingCount || 0
          }
        }
      };
    } catch (error) {
      logger.error('Error fetching user profile', { userId, error });
      return null;
    }
  }

  async searchUsers(query: string, limit: number = 20): Promise<UserProfile[]> {
    try {
      const { data: users, error } = await supabase
        .from('users')
        .select('id, username, profile_data')
        .or(`username.ilike.%${query}%,profile_data->>displayName.ilike.%${query}%`)
        .limit(limit);

      if (error) {
        logger.error('Failed to search users', { query, error: error.message });
        return [];
      }

      return users.map(user => ({
        id: user.id,
        username: user.username,
        profile_data: user.profile_data || {}
      }));
    } catch (error) {
      logger.error('Error searching users', { query, error });
      return [];
    }
  }

  async followUser(userId: string, targetUserId: string): Promise<boolean> {
    try {
      // Check if already following
      const { data: existing } = await supabase
        .from('social_interactions')
        .select('id')
        .eq('user_id', userId)
        .eq('target_user_id', targetUserId)
        .eq('interaction_type', 'follow')
        .single();

      if (existing) {
        return true; // Already following
      }

      const { error } = await supabase
        .from('social_interactions')
        .insert({
          user_id: userId,
          target_user_id: targetUserId,
          interaction_type: 'follow',
          target_type: 'user',
          target_id: targetUserId
        });

      if (error) {
        logger.error('Failed to follow user', { userId, targetUserId, error: error.message });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error following user', { userId, targetUserId, error });
      return false;
    }
  }

  async unfollowUser(userId: string, targetUserId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('social_interactions')
        .delete()
        .eq('user_id', userId)
        .eq('target_user_id', targetUserId)
        .eq('interaction_type', 'follow');

      if (error) {
        logger.error('Failed to unfollow user', { userId, targetUserId, error: error.message });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error unfollowing user', { userId, targetUserId, error });
      return false;
    }
  }

  async getFollowers(userId: string, limit: number = 50): Promise<UserProfile[]> {
    try {
      const { data: followers, error } = await supabase
        .from('social_interactions')
        .select(`
          user_id,
          users!social_interactions_user_id_fkey (
            id, username, profile_data
          )
        `)
        .eq('target_user_id', userId)
        .eq('interaction_type', 'follow')
        .limit(limit);

      if (error) {
        logger.error('Failed to fetch followers', { userId, error: error.message });
        return [];
      }

      return followers.map(f => ({
        id: f.users.id,
        username: f.users.username,
        profile_data: f.users.profile_data || {}
      }));
    } catch (error) {
      logger.error('Error fetching followers', { userId, error });
      return [];
    }
  }

  async getFollowing(userId: string, limit: number = 50): Promise<UserProfile[]> {
    try {
      const { data: following, error } = await supabase
        .from('social_interactions')
        .select(`
          target_user_id,
          users!social_interactions_target_user_id_fkey (
            id, username, profile_data
          )
        `)
        .eq('user_id', userId)
        .eq('interaction_type', 'follow')
        .limit(limit);

      if (error) {
        logger.error('Failed to fetch following', { userId, error: error.message });
        return [];
      }

      return following.map(f => ({
        id: f.users.id,
        username: f.users.username,
        profile_data: f.users.profile_data || {}
      }));
    } catch (error) {
      logger.error('Error fetching following', { userId, error });
      return [];
    }
  }

  async likeContent(userId: string, targetType: string, targetId: string): Promise<boolean> {
    try {
      // Check if already liked
      const { data: existing } = await supabase
        .from('social_interactions')
        .select('id')
        .eq('user_id', userId)
        .eq('target_type', targetType)
        .eq('target_id', targetId)
        .eq('interaction_type', 'like')
        .single();

      if (existing) {
        return true; // Already liked
      }

      const { error } = await supabase
        .from('social_interactions')
        .insert({
          user_id: userId,
          interaction_type: 'like',
          target_type: targetType,
          target_id: targetId
        });

      if (error) {
        logger.error('Failed to like content', { userId, targetType, targetId, error: error.message });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error liking content', { userId, targetType, targetId, error });
      return false;
    }
  }

  async unlikeContent(userId: string, targetType: string, targetId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('social_interactions')
        .delete()
        .eq('user_id', userId)
        .eq('target_type', targetType)
        .eq('target_id', targetId)
        .eq('interaction_type', 'like');

      if (error) {
        logger.error('Failed to unlike content', { userId, targetType, targetId, error: error.message });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error unliking content', { userId, targetType, targetId, error });
      return false;
    }
  }

  async addComment(
    userId: string,
    targetType: string,
    targetId: string,
    content: string
  ): Promise<SocialInteraction | null> {
    try {
      const { data: comment, error } = await supabase
        .from('social_interactions')
        .insert({
          user_id: userId,
          interaction_type: 'comment',
          target_type: targetType,
          target_id: targetId,
          content: content
        })
        .select()
        .single();

      if (error) {
        logger.error('Failed to add comment', { userId, targetType, targetId, error: error.message });
        return null;
      }

      return comment;
    } catch (error) {
      logger.error('Error adding comment', { userId, targetType, targetId, error });
      return null;
    }
  }

  async getComments(targetType: string, targetId: string, limit: number = 50): Promise<SocialInteraction[]> {
    try {
      const { data: comments, error } = await supabase
        .from('social_interactions')
        .select(`
          *,
          users!social_interactions_user_id_fkey (
            username, profile_data
          )
        `)
        .eq('target_type', targetType)
        .eq('target_id', targetId)
        .eq('interaction_type', 'comment')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Failed to fetch comments', { targetType, targetId, error: error.message });
        return [];
      }

      return comments;
    } catch (error) {
      logger.error('Error fetching comments', { targetType, targetId, error });
      return [];
    }
  }
}

export const socialService = new SocialService();
