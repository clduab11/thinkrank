import { Router } from 'express';
import { achievementController } from '../controllers/achievement.controller';

const router = Router();

// Get all available achievements
router.get('/available', achievementController.getAvailableAchievements);

// Get user's achievements
router.get('/user/:userId', achievementController.getUserAchievements);
router.get('/user/:userId/progress', achievementController.getAchievementProgress);

// Check and unlock new achievements
router.post('/check/:userId', achievementController.checkAchievements);

// Get specific achievement details
router.get('/:achievementId', achievementController.getAchievementDetails);

export { router as achievementRoutes };
