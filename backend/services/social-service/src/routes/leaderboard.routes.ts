import { Router } from 'express';
import { leaderboardController } from '../controllers/leaderboard.controller';

const router = Router();

// Global leaderboards
router.get('/global', leaderboardController.getGlobalLeaderboard);
router.get('/category/:category', leaderboardController.getCategoryLeaderboard);

// Friends leaderboard
router.get('/friends', leaderboardController.getFriendsLeaderboard);

// User rank
router.get('/rank/:userId', leaderboardController.getUserRank);
router.get('/rank/:userId/:category', leaderboardController.getUserCategoryRank);

export { router as leaderboardRoutes };
