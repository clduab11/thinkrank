import { Router } from 'express';
import { sharingController } from '../controllers/sharing.controller';
import { requireFeature } from '../middleware/subscription.middleware';

const router = Router();

// Social media platform integration
router.post('/facebook', requireFeature('hasSocialSharing'), sharingController.shareToFacebook);
router.post('/instagram', requireFeature('hasSocialSharing'), sharingController.shareToInstagram);
router.post('/twitter', requireFeature('hasSocialSharing'), sharingController.shareToTwitter);
router.post('/tiktok', requireFeature('hasSocialSharing'), sharingController.shareToTikTok);

// Share content generation
router.post('/generate-content', sharingController.generateShareContent);
router.post('/generate-image', sharingController.generateShareImage);

// Platform token validation
router.post('/validate-token', sharingController.validatePlatformToken);

// Get shareable URL
router.get('/url/:contentType/:contentId', sharingController.getShareableUrl);

export { router as sharingRoutes };
