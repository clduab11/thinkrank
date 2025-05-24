import compression from 'compression';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import 'express-async-errors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';

import { errorHandler } from './middleware/error.middleware';
import { requestLogger } from './middleware/request.middleware';
import { analyticsRoutes } from './routes/analytics.routes';
import { dashboardRoutes } from './routes/dashboard.routes';
import { healthRoutes } from './routes/health.routes';
import { metricsRoutes } from './routes/metrics.routes';
import { AlertingService } from './services/alerting.service';
import { logger } from './services/logger.service';
import { MetricsCollector } from './services/metrics.service';

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
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP'
});
app.use(limiter);

// General middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));
app.use(requestLogger);

// Routes
app.use('/health', healthRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/metrics', metricsRoutes);

// Error handling
app.use(errorHandler);

// Initialize services
const alertingService = new AlertingService();
const metricsCollector = new MetricsCollector();

// Start server
app.listen(PORT, () => {
  logger.info(`Analytics service running on port ${PORT}`);

  // Initialize monitoring services
  metricsCollector.start();
  alertingService.initialize();

  logger.info('Analytics and monitoring services initialized');
});

export default app;
