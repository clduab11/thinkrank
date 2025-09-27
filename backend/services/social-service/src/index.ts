import compression from 'compression';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import 'express-async-errors';
import { createRateLimitMiddleware, createDDoSProtection } from '@thinkrank/shared';
import helmet from 'helmet';
import morgan from 'morgan';

import { logger } from '@thinkrank/shared';
import { authMiddleware } from './middleware/auth.middleware';
import { errorHandler } from './middleware/error.middleware';
import { requestMiddleware } from './middleware/request.middleware';
import { subscriptionMiddleware } from './middleware/subscription.middleware';

// Route imports
import { achievementRoutes } from './routes/achievement.routes';
import { healthRoutes } from './routes/health.routes';
import { leaderboardRoutes } from './routes/leaderboard.routes';
import { paymentRoutes } from './routes/payment.routes';
import { sharingRoutes } from './routes/sharing.routes';
import { socialRoutes } from './routes/social.routes';
import { subscriptionRoutes } from './routes/subscription.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3005;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

 // Rate limiting
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
// DDoS protection and distributed rate limiting (cluster-aware)
app.use(createDDoSProtection(REDIS_URL));
app.use(createRateLimitMiddleware(REDIS_URL, 'api'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());

// Logging middleware
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) }
}));

// Custom middleware
app.use(requestMiddleware);

// Public routes (no auth required)
app.use('/health', healthRoutes);

// Protected routes (auth required)
app.use('/social', authMiddleware, socialRoutes);
app.use('/leaderboards', authMiddleware, leaderboardRoutes);
app.use('/achievements', authMiddleware, achievementRoutes);
app.use('/sharing', authMiddleware, sharingRoutes);

// Subscription and payment routes (with subscription validation)
app.use('/subscriptions', authMiddleware, subscriptionRoutes);
app.use('/payments', authMiddleware, subscriptionMiddleware, paymentRoutes);

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`Social service listening on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

export default app;
