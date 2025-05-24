// Authentication routes for the auth service
import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { asyncHandler } from '../middleware/error.middleware';
import { userRateLimitMiddleware, validateContentType } from '../middleware/request.middleware';

const router = Router();
const authController = new AuthController();

// Apply content type validation for POST/PUT requests
router.use(validateContentType('application/json'));

// Apply more restrictive rate limiting for auth endpoints
const authRateLimit = userRateLimitMiddleware(10, 60000); // 10 requests per minute per user

// Authentication endpoints
router.post('/register',
  authRateLimit,
  asyncHandler(authController.register.bind(authController))
);

router.post('/login',
  authRateLimit,
  asyncHandler(authController.login.bind(authController))
);

router.post('/refresh',
  authRateLimit,
  asyncHandler(authController.refreshToken.bind(authController))
);

router.post('/logout',
  authRateLimit,
  asyncHandler(authController.logout.bind(authController))
);

router.post('/forgot-password',
  authRateLimit,
  asyncHandler(authController.forgotPassword.bind(authController))
);

router.post('/reset-password',
  authRateLimit,
  asyncHandler(authController.resetPassword.bind(authController))
);

router.post('/verify-email',
  authRateLimit,
  asyncHandler(authController.verifyEmail.bind(authController))
);

router.post('/resend-verification',
  authRateLimit,
  asyncHandler(authController.resendVerification.bind(authController))
);

// Profile management endpoints (require authentication)
router.get('/profile',
  asyncHandler(authController.getProfile.bind(authController))
);

router.put('/profile',
  asyncHandler(authController.updateProfile.bind(authController))
);

router.put('/change-password',
  authRateLimit,
  asyncHandler(authController.changePassword.bind(authController))
);

router.delete('/account',
  authRateLimit,
  asyncHandler(authController.deleteAccount.bind(authController))
);

export { router as authRoutes };
