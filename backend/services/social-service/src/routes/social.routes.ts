import { Router } from 'express';
import { socialController } from '../controllers/social.controller';

const router = Router();

// User profile routes
router.get('/profile/:userId', socialController.getUserProfile);
router.get('/search', socialController.searchUsers);

// Following/followers routes
router.post('/follow/:userId', socialController.followUser);
router.delete('/follow/:userId', socialController.unfollowUser);
router.get('/followers/:userId', socialController.getFollowers);
router.get('/following/:userId', socialController.getFollowing);

// Content interaction routes
router.post('/like', socialController.likeContent);
router.delete('/like', socialController.unlikeContent);
router.post('/comment', socialController.addComment);
router.get('/comments/:targetType/:targetId', socialController.getComments);

export { router as socialRoutes };
