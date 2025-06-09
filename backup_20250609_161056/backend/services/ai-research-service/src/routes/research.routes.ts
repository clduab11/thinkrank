import { Router } from 'express';
import { ResearchController } from '../controllers/research.controller';
import { contributionRateLimitMiddleware } from '../middleware/request.middleware';

const router = Router();
const researchController = new ResearchController();

/**
 * Get available research problems for user
 * GET /api/research/problems
 */
router.get('/problems', researchController.getProblems.bind(researchController));

/**
 * Get specific research problem by ID
 * GET /api/research/problems/:problemId
 */
router.get('/problems/:problemId', researchController.getProblemById.bind(researchController));

/**
 * Generate new research problem
 * POST /api/research/problems/generate
 */
router.post('/problems/generate', researchController.generateProblem.bind(researchController));

/**
 * Transform research problem to game format
 * POST /api/research/problems/:problemId/transform
 */
router.post('/problems/:problemId/transform', researchController.transformToGame.bind(researchController));

/**
 * Get user's research progress and statistics
 * GET /api/research/progress
 */
router.get('/progress', researchController.getUserProgress.bind(researchController));

/**
 * Get research leaderboard
 * GET /api/research/leaderboard
 */
router.get('/leaderboard', researchController.getLeaderboard.bind(researchController));

/**
 * Get research problem categories and types
 * GET /api/research/categories
 */
router.get('/categories', researchController.getCategories.bind(researchController));

/**
 * Submit research contribution (with rate limiting)
 * POST /api/research/contribute
 */
router.post('/contribute',
  contributionRateLimitMiddleware(5, 60000), // 5 contributions per minute max
  researchController.submitContribution.bind(researchController)
);

export default router;
