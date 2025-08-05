import { Router } from 'express';
import { FallbackService } from '../services/fallback.service';
import { ConnectionManager } from '../services/connection.service';
import { GameStateManager } from '../services/game-state.service';
import { RedisManager } from '../services/redis.service';
import { AuthenticationService } from '../services/auth.service';
import { logger } from '@thinkrank/shared';

export function createRealtimeRoutes(
  fallbackService: FallbackService,
  connectionManager: ConnectionManager,
  gameStateManager: GameStateManager,
  redisManager: RedisManager
): Router {
  const router = Router();
  const authService = new AuthenticationService();

  // Authentication middleware for routes
  const authenticateRoute = async (req: any, res: any, next: any) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
      const user = await authService.authenticateToken(token);
      
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      req.user = user;
      next();
    } catch (error) {
      logger.error('Route authentication error:', error);
      res.status(401).json({ error: 'Invalid authentication' });
    }
  };

  // Server-Sent Events endpoint
  router.get('/sse', authenticateRoute, async (req, res) => {
    try {
      const userId = req.user.id;
      await fallbackService.handleSSEConnection(req, res, userId);
    } catch (error) {
      logger.error('SSE connection error:', error);
      res.status(500).json({ error: 'SSE connection failed' });
    }
  });

  // Long polling endpoint
  router.get('/poll', authenticateRoute, async (req, res) => {
    try {
      const userId = req.user.id;
      await fallbackService.handlePollingConnection(req, res, userId);
    } catch (error) {
      logger.error('Polling connection error:', error);
      res.status(500).json({ error: 'Polling connection failed' });
    }
  });

  // SSE subscription management
  router.post('/sse/:connectionId/subscribe', authenticateRoute, async (req, res) => {
    try {
      const { connectionId } = req.params;
      const { channel } = req.body;

      if (!channel) {
        return res.status(400).json({ error: 'Channel is required' });
      }

      const success = await fallbackService.subscribeSSE(connectionId, channel);
      
      if (success) {
        res.json({ success: true, message: 'Subscribed to channel' });
      } else {
        res.status(404).json({ error: 'Connection not found' });
      }
    } catch (error) {
      logger.error('SSE subscription error:', error);
      res.status(500).json({ error: 'Subscription failed' });
    }
  });

  router.delete('/sse/:connectionId/subscribe/:channel', authenticateRoute, async (req, res) => {
    try {
      const { connectionId, channel } = req.params;

      const success = await fallbackService.unsubscribeSSE(connectionId, channel);
      
      if (success) {
        res.json({ success: true, message: 'Unsubscribed from channel' });
      } else {
        res.status(404).json({ error: 'Connection not found' });
      }
    } catch (error) {
      logger.error('SSE unsubscription error:', error);
      res.status(500).json({ error: 'Unsubscription failed' });
    }
  });

  // Polling subscription management
  router.post('/poll/:connectionId/subscribe', authenticateRoute, async (req, res) => {
    try {
      const { connectionId } = req.params;
      const { channel } = req.body;

      if (!channel) {
        return res.status(400).json({ error: 'Channel is required' });
      }

      const success = await fallbackService.subscribePolling(connectionId, channel);
      
      res.json({ success, message: success ? 'Subscribed to channel' : 'Connection not found' });
    } catch (error) {
      logger.error('Polling subscription error:', error);
      res.status(500).json({ error: 'Subscription failed' });
    }
  });

  // Game state endpoints
  router.post('/games', authenticateRoute, async (req, res) => {
    try {
      const { type, configuration } = req.body;
      const userId = req.user.id;

      const gameState = await gameStateManager.createGame({
        type,
        configuration,
        players: [{
          id: userId,
          username: req.user.username,
          joinedAt: new Date(),
          status: 'active',
          score: 0,
          progress: {}
        }]
      });

      res.json({ success: true, game: gameState });
    } catch (error) {
      logger.error('Game creation error:', error);
      res.status(500).json({ error: 'Failed to create game' });
    }
  });

  router.get('/games/:gameId', authenticateRoute, async (req, res) => {
    try {
      const { gameId } = req.params;
      const gameState = await gameStateManager.getGameState(gameId);

      if (!gameState) {
        return res.status(404).json({ error: 'Game not found' });
      }

      res.json({ success: true, game: gameState });
    } catch (error) {
      logger.error('Game retrieval error:', error);
      res.status(500).json({ error: 'Failed to retrieve game' });
    }
  });

  router.post('/games/:gameId/join', authenticateRoute, async (req, res) => {
    try {
      const { gameId } = req.params;
      const userId = req.user.id;
      const username = req.user.username;

      const result = await gameStateManager.addPlayerToGame(gameId, userId, username);

      if (result.success) {
        res.json({ success: true, game: result.gameState });
      } else {
        res.status(400).json({ error: result.error });
      }
    } catch (error) {
      logger.error('Game join error:', error);
      res.status(500).json({ error: 'Failed to join game' });
    }
  });

  router.post('/games/:gameId/leave', authenticateRoute, async (req, res) => {
    try {
      const { gameId } = req.params;
      const userId = req.user.id;

      const result = await gameStateManager.removePlayerFromGame(gameId, userId);

      if (result.success) {
        res.json({ success: true, game: result.gameState });
      } else {
        res.status(500).json({ error: 'Failed to leave game' });
      }
    } catch (error) {
      logger.error('Game leave error:', error);
      res.status(500).json({ error: 'Failed to leave game' });
    }
  });

  router.post('/games/:gameId/actions', authenticateRoute, async (req, res) => {
    try {
      const { gameId } = req.params;
      const { action, payload } = req.body;
      const userId = req.user.id;

      if (!action) {
        return res.status(400).json({ error: 'Action is required' });
      }

      const result = await gameStateManager.processGameAction(gameId, userId, action, payload);

      if (result.success) {
        res.json({ success: true, result: result.data });
      } else {
        res.status(400).json({ error: result.error });
      }
    } catch (error) {
      logger.error('Game action error:', error);
      res.status(500).json({ error: 'Failed to process game action' });
    }
  });

  // Connection management endpoints
  router.get('/connections', authenticateRoute, async (req, res) => {
    try {
      const userId = req.user.id;
      const connections = await connectionManager.getUserConnections(userId);
      
      res.json({ 
        success: true, 
        connections: connections.map(conn => ({
          socketId: conn.socketId,
          sessionId: conn.sessionId,
          status: conn.status,
          joinedAt: conn.joinedAt,
          lastActivity: conn.lastActivity,
          subscriptions: conn.subscriptions,
          gameSession: conn.gameSession
        }))
      });
    } catch (error) {
      logger.error('Connection retrieval error:', error);
      res.status(500).json({ error: 'Failed to retrieve connections' });
    }
  });

  router.get('/connections/stats', authenticateRoute, async (req, res) => {
    try {
      const stats = await connectionManager.getConnectionStats();
      res.json({ success: true, stats });
    } catch (error) {
      logger.error('Connection stats error:', error);
      res.status(500).json({ error: 'Failed to retrieve connection stats' });
    }
  });

  // Session recovery
  router.post('/sessions/:sessionId/recover', authenticateRoute, async (req, res) => {
    try {
      const { sessionId } = req.params;
      const recoveryData = await connectionManager.recoverSession(sessionId);

      if (recoveryData) {
        res.json({ success: true, recovery: recoveryData });
      } else {
        res.status(404).json({ error: 'Session not found or expired' });
      }
    } catch (error) {
      logger.error('Session recovery error:', error);
      res.status(500).json({ error: 'Failed to recover session' });
    }
  });

  // Cache management endpoints
  router.post('/cache/warm', authenticateRoute, async (req, res) => {
    try {
      const { patterns } = req.body;
      
      if (!Array.isArray(patterns)) {
        return res.status(400).json({ error: 'Patterns must be an array' });
      }

      await redisManager.warmCache(patterns);
      res.json({ success: true, message: 'Cache warming initiated' });
    } catch (error) {
      logger.error('Cache warming error:', error);
      res.status(500).json({ error: 'Failed to warm cache' });
    }
  });

  router.delete('/cache/invalidate', authenticateRoute, async (req, res) => {
    try {
      const { pattern } = req.body;
      
      if (!pattern) {
        return res.status(400).json({ error: 'Pattern is required' });
      }

      const deletedCount = await redisManager.invalidatePattern(pattern);
      res.json({ success: true, deletedCount });
    } catch (error) {
      logger.error('Cache invalidation error:', error);
      res.status(500).json({ error: 'Failed to invalidate cache' });
    }
  });

  // Message history endpoints
  router.get('/messages/:type/:target', authenticateRoute, async (req, res) => {
    try {
      const { type, target } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;

      const messages = await redisManager.getMessageHistory(type, target, limit);
      res.json({ success: true, messages });
    } catch (error) {
      logger.error('Message history error:', error);
      res.status(500).json({ error: 'Failed to retrieve message history' });
    }
  });

  // Broadcasting endpoints for admin use
  router.post('/broadcast/all', authenticateRoute, async (req, res) => {
    try {
      // Check if user has admin privileges (implement your own logic)
      if (!req.user.isAdmin) {
        return res.status(403).json({ error: 'Admin privileges required' });
      }

      const { event, data } = req.body;
      
      if (!event) {
        return res.status(400).json({ error: 'Event is required' });
      }

      // Broadcast via fallback services
      const result = await fallbackService.broadcastToChannel('system', event, data);
      
      res.json({ 
        success: true, 
        message: 'Broadcast sent',
        delivered: result
      });
    } catch (error) {
      logger.error('Broadcast error:', error);
      res.status(500).json({ error: 'Failed to broadcast message' });
    }
  });

  router.post('/broadcast/channel/:channel', authenticateRoute, async (req, res) => {
    try {
      if (!req.user.isAdmin) {
        return res.status(403).json({ error: 'Admin privileges required' });
      }

      const { channel } = req.params;
      const { event, data } = req.body;
      
      if (!event) {
        return res.status(400).json({ error: 'Event is required' });
      }

      const result = await fallbackService.broadcastToChannel(channel, event, data);
      
      res.json({ 
        success: true, 
        message: 'Channel broadcast sent',
        delivered: result
      });
    } catch (error) {
      logger.error('Channel broadcast error:', error);
      res.status(500).json({ error: 'Failed to broadcast to channel' });
    }
  });

  // System status
  router.get('/status', async (req, res) => {
    try {
      const connectionHealth = await connectionManager.getHealthStatus();
      const fallbackHealth = await fallbackService.getHealthStatus();
      const fallbackStats = fallbackService.getFallbackStats();

      res.json({
        success: true,
        status: {
          connections: connectionHealth,
          fallback: {
            health: fallbackHealth,
            stats: fallbackStats
          },
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Status check error:', error);
      res.status(500).json({ error: 'Failed to get system status' });
    }
  });

  return router;
}