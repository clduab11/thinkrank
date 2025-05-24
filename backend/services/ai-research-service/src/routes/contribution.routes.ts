import { Router } from 'express';
import { ContributionController } from '../controllers/contribution.controller';

const router = Router();
const contributionController = new ContributionController();

/**
 * Get user's contributions
 * GET /api/contributions
 */
router.get('/', contributionController.getUserContributions.bind(contributionController));

/**
 * Get contribution by ID
 * GET /api/contributions/:contributionId
 */
router.get('/:contributionId', contributionController.getContributionById.bind(contributionController));

/**
 * Submit peer review
 * POST /api/contributions/:contributionId/review
 */
router.post('/:contributionId/review', contributionController.submitPeerReview.bind(contributionController));

/**
 * Get contributions for peer review
 * GET /api/contributions/review/pending
 */
router.get('/review/pending', contributionController.getPendingReviews.bind(contributionController));

export default router;
