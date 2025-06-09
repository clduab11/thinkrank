import { logger } from '@thinkrank/shared';
import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { socialService } from '../services/social.service';

class SocialController {

  async getUserProfile(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
        return;
      }

      const profile = await socialService.getUserProfile(userId);

      if (!profile) {
        res.status(404).json({
          success: false,
          error: 'User profile not found'
        });
        return;
      }

      res.json({
        success: true,
        data: profile
      });

    } catch (error) {
      logger.error('Error fetching user profile', { error, userId: req.params.userId });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch user profile'
      });
    }
  }

  async searchUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { q: query, limit = 20 } = req.query;

      if (!query || typeof query !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Search query is required'
        });
        return;
      }

      const users = await socialService.searchUsers(query, parseInt(limit as string));

      res.json({
        success: true,
        data: users
      });

    } catch (error) {
      logger.error('Error searching users', { error, query: req.query.q });
      res.status(500).json({
        success: false,
        error: 'Failed to search users'
      });
    }
  }

  async followUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { userId: targetUserId } = req.params;
      const userId = req.user!.id;

      if (userId === targetUserId) {
        res.status(400).json({
          success: false,
          error: 'Cannot follow yourself'
        });
        return;
      }

      const success = await socialService.followUser(userId, targetUserId);

      if (!success) {
        res.status(500).json({
          success: false,
          error: 'Failed to follow user'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Successfully followed user'
      });

    } catch (error) {
      logger.error('Error following user', { error, userId: req.user?.id, targetUserId: req.params.userId });
      res.status(500).json({
        success: false,
        error: 'Failed to follow user'
      });
    }
  }

  async unfollowUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { userId: targetUserId } = req.params;
      const userId = req.user!.id;

      const success = await socialService.unfollowUser(userId, targetUserId);

      if (!success) {
        res.status(500).json({
          success: false,
          error: 'Failed to unfollow user'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Successfully unfollowed user'
      });

    } catch (error) {
      logger.error('Error unfollowing user', { error, userId: req.user?.id, targetUserId: req.params.userId });
      res.status(500).json({
        success: false,
        error: 'Failed to unfollow user'
      });
    }
  }

  async getFollowers(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { limit = 50 } = req.query;

      const followers = await socialService.getFollowers(userId, parseInt(limit as string));

      res.json({
        success: true,
        data: followers
      });

    } catch (error) {
      logger.error('Error fetching followers', { error, userId: req.params.userId });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch followers'
      });
    }
  }

  async getFollowing(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { limit = 50 } = req.query;

      const following = await socialService.getFollowing(userId, parseInt(limit as string));

      res.json({
        success: true,
        data: following
      });

    } catch (error) {
      logger.error('Error fetching following', { error, userId: req.params.userId });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch following'
      });
    }
  }

  async likeContent(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { targetType, targetId } = req.body;
      const userId = req.user!.id;

      if (!targetType || !targetId) {
        res.status(400).json({
          success: false,
          error: 'Target type and target ID are required'
        });
        return;
      }

      const success = await socialService.likeContent(userId, targetType, targetId);

      if (!success) {
        res.status(500).json({
          success: false,
          error: 'Failed to like content'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Content liked successfully'
      });

    } catch (error) {
      logger.error('Error liking content', { error, userId: req.user?.id, body: req.body });
      res.status(500).json({
        success: false,
        error: 'Failed to like content'
      });
    }
  }

  async unlikeContent(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { targetType, targetId } = req.body;
      const userId = req.user!.id;

      if (!targetType || !targetId) {
        res.status(400).json({
          success: false,
          error: 'Target type and target ID are required'
        });
        return;
      }

      const success = await socialService.unlikeContent(userId, targetType, targetId);

      if (!success) {
        res.status(500).json({
          success: false,
          error: 'Failed to unlike content'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Content unliked successfully'
      });

    } catch (error) {
      logger.error('Error unliking content', { error, userId: req.user?.id, body: req.body });
      res.status(500).json({
        success: false,
        error: 'Failed to unlike content'
      });
    }
  }

  async addComment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { targetType, targetId, content } = req.body;
      const userId = req.user!.id;

      if (!targetType || !targetId || !content) {
        res.status(400).json({
          success: false,
          error: 'Target type, target ID, and content are required'
        });
        return;
      }

      const comment = await socialService.addComment(userId, targetType, targetId, content);

      if (!comment) {
        res.status(500).json({
          success: false,
          error: 'Failed to add comment'
        });
        return;
      }

      res.json({
        success: true,
        data: comment
      });

    } catch (error) {
      logger.error('Error adding comment', { error, userId: req.user?.id, body: req.body });
      res.status(500).json({
        success: false,
        error: 'Failed to add comment'
      });
    }
  }

  async getComments(req: Request, res: Response): Promise<void> {
    try {
      const { targetType, targetId } = req.params;
      const { limit = 50 } = req.query;

      const comments = await socialService.getComments(targetType, targetId, parseInt(limit as string));

      res.json({
        success: true,
        data: comments
      });

    } catch (error) {
      logger.error('Error fetching comments', { error, params: req.params });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch comments'
      });
    }
  }
}

export const socialController = new SocialController();
