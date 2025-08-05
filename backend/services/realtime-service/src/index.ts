import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { logger } from '@thinkrank/shared';
import { WebSocketManager } from './services/websocket.service';
import { EventBroker } from './services/event-broker.service';
import { RedisManager } from './services/redis.service';
import { ConnectionManager } from './services/connection.service';
import { healthRoutes } from './routes/health.routes';
import { realtimeRoutes } from './routes/realtime.routes';
import { errorHandler } from './middleware/error.middleware';
import { requestLogger } from './middleware/logging.middleware';
import { metricsMiddleware } from './middleware/metrics.middleware';
import cluster from 'cluster';
import { cpus } from 'os';
import sticky from 'sticky-session';

const app = express();
const server = createServer(app);
const port = process.env.PORT || 3008;

// Clustering for scalability
if (cluster.isPrimary && process.env.NODE_ENV === 'production') {
  const numWorkers = cpus().length;
  logger.info(`Master ${process.pid} is running`);
  
  for (let i = 0; i < numWorkers; i++) {
    cluster.fork();
  }
  
  cluster.on('exit', (worker, code, signal) => {
    logger.warn(`Worker ${worker.process.pid} died`);
    cluster.fork();
  });
} else {
  // Initialize services
  const redisManager = new RedisManager();
  const eventBroker = new EventBroker();
  const connectionManager = new ConnectionManager();
  
  // Socket.IO setup with Redis adapter
  const io = new SocketIOServer(server, {
    cors: {
      origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000
  });

  const wsManager = new WebSocketManager(io, redisManager, eventBroker, connectionManager);

  // Middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", "ws:", "wss:"]
      }
    }
  }));
  
  app.use(cors({
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true
  }));
  
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs
    message: 'Too many requests from this IP'
  }));
  
  app.use(requestLogger);
  app.use(metricsMiddleware);

  // Routes
  app.use('/health', healthRoutes);
  app.use('/api/realtime', realtimeRoutes);

  // Error handling
  app.use(errorHandler);

  // Initialize services
  async function initializeServices() {
    try {
      await redisManager.connect();
      await eventBroker.connect();
      await wsManager.initialize();
      
      logger.info('All services initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize services:', error);
      process.exit(1);
    }
  }

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
      redisManager.disconnect();
      eventBroker.disconnect();
      process.exit(0);
    });
  });

  // Start server
  if (!sticky.listen(server, port)) {
    server.once('listening', async () => {
      logger.info(`Realtime service worker ${process.pid} listening on port ${port}`);
      await initializeServices();
    });
  }
}

export { app, server };