import { Router } from 'express';
import { RedisManager } from '../services/redis.service';
import { EventBroker } from '../services/event-broker.service';
import { ConnectionManager } from '../services/connection.service';
import { FallbackService } from '../services/fallback.service';

const router = Router();

let redisManager: RedisManager;
let eventBroker: EventBroker;
let connectionManager: ConnectionManager;
let fallbackService: FallbackService;

export function initializeHealthRoutes(
  redis: RedisManager,
  broker: EventBroker,
  connMgr: ConnectionManager,
  fallback: FallbackService
): Router {
  redisManager = redis;
  eventBroker = broker;
  connectionManager = connMgr;
  fallbackService = fallback;
  
  return router;
}

// Basic health check
router.get('/', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Basic service check
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      responseTime: 0,
      services: {} as any
    };

    // Check Redis if available
    if (redisManager) {
      try {
        await redisManager.getMainClient().ping();
        health.services.redis = { status: 'healthy', message: 'Connected' };
      } catch (error) {
        health.status = 'degraded';
        health.services.redis = { status: 'unhealthy', message: error.message };
      }
    }

    // Check Event Broker if available
    if (eventBroker) {
      try {
        const brokerHealth = await eventBroker.healthCheck();
        health.services.eventBroker = brokerHealth;
        if (brokerHealth.status === 'unhealthy') {
          health.status = 'degraded';
        }
      } catch (error) {
        health.status = 'degraded';
        health.services.eventBroker = { status: 'unhealthy', message: error.message };
      }
    }

    // Check Connection Manager if available
    if (connectionManager) {
      try {
        const connHealth = await connectionManager.getHealthStatus();
        health.services.connectionManager = connHealth;
        if (connHealth.status === 'unhealthy') {
          health.status = 'unhealthy';
        } else if (connHealth.status === 'degraded') {
          health.status = 'degraded';
        }
      } catch (error) {
        health.status = 'degraded';
        health.services.connectionManager = { status: 'unhealthy', message: error.message };
      }
    }

    // Check Fallback Service if available
    if (fallbackService) {
      try {
        const fallbackHealth = await fallbackService.getHealthStatus();
        health.services.fallbackService = fallbackHealth;
        if (fallbackHealth.status === 'unhealthy') {
          health.status = 'degraded';
        }
      } catch (error) {
        health.status = 'degraded';
        health.services.fallbackService = { status: 'unhealthy', message: error.message };
      }
    }

    health.responseTime = Date.now() - startTime;

    // Set appropriate HTTP status code
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 207 : 500;

    res.status(statusCode).json(health);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Detailed health check
router.get('/detailed', async (req, res) => {
  try {
    const startTime = Date.now();
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    const detailedHealth = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      responseTime: 0,
      system: {
        memory: {
          rss: Math.round(memoryUsage.rss / 1024 / 1024) + ' MB',
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
          external: Math.round(memoryUsage.external / 1024 / 1024) + ' MB'
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        },
        node: process.version,
        platform: process.platform,
        arch: process.arch
      },
      services: {} as any,
      metrics: {} as any
    };

    // Detailed Redis check
    if (redisManager) {
      try {
        const start = Date.now();
        await redisManager.getMainClient().ping();
        const responseTime = Date.now() - start;
        
        // Get Redis info if possible
        let redisInfo = {};
        try {
          const info = await redisManager.getMainClient().info();
          const lines = info.split('\r\n');
          for (const line of lines) {
            if (line.includes(':')) {
              const [key, value] = line.split(':');
              redisInfo[key] = value;
            }
          }
        } catch (infoError) {
          // Redis info not available
        }

        detailedHealth.services.redis = {
          status: 'healthy',
          responseTime: responseTime + 'ms',
          info: redisInfo
        };
      } catch (error) {
        detailedHealth.status = 'degraded';
        detailedHealth.services.redis = {
          status: 'unhealthy',
          error: error.message
        };
      }
    }

    // Detailed Connection Manager metrics
    if (connectionManager) {
      try {
        const connStats = await connectionManager.getConnectionStats();
        const connHealth = await connectionManager.getHealthStatus();
        
        detailedHealth.services.connectionManager = {
          ...connHealth,
          stats: connStats
        };

        detailedHealth.metrics.connections = connStats;
      } catch (error) {
        detailedHealth.status = 'degraded';
        detailedHealth.services.connectionManager = {
          status: 'unhealthy',
          error: error.message
        };
      }
    }

    // Detailed Fallback Service metrics
    if (fallbackService) {
      try {
        const fallbackHealth = await fallbackService.getHealthStatus();
        const fallbackStats = fallbackService.getFallbackStats();
        
        detailedHealth.services.fallbackService = {
          ...fallbackHealth,
          stats: fallbackStats
        };

        detailedHealth.metrics.fallback = fallbackStats;
      } catch (error) {
        detailedHealth.status = 'degraded';
        detailedHealth.services.fallbackService = {
          status: 'unhealthy',
          error: error.message
        };
      }
    }

    detailedHealth.responseTime = Date.now() - startTime;

    const statusCode = detailedHealth.status === 'healthy' ? 200 : 
                      detailedHealth.status === 'degraded' ? 207 : 500;

    res.status(statusCode).json(detailedHealth);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Readiness check (for Kubernetes)
router.get('/ready', async (req, res) => {
  try {
    let ready = true;
    const checks = [];

    // Check Redis readiness
    if (redisManager) {
      try {
        await redisManager.getMainClient().ping();
        checks.push({ service: 'redis', ready: true });
      } catch (error) {
        checks.push({ service: 'redis', ready: false, error: error.message });
        ready = false;
      }
    }

    // Check Event Broker readiness
    if (eventBroker) {
      try {
        const health = await eventBroker.healthCheck();
        const isReady = health.status !== 'unhealthy';
        checks.push({ service: 'eventBroker', ready: isReady });
        if (!isReady) ready = false;
      } catch (error) {
        checks.push({ service: 'eventBroker', ready: false, error: error.message });
        ready = false;
      }
    }

    res.status(ready ? 200 : 503).json({
      ready,
      timestamp: new Date().toISOString(),
      checks
    });
  } catch (error) {
    res.status(503).json({
      ready: false,
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Liveness check (for Kubernetes)
router.get('/live', (req, res) => {
  // Simple liveness check - if we can respond, we're alive
  res.json({
    alive: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Metrics endpoint (Prometheus compatible)
router.get('/metrics', async (req, res) => {
  try {
    const metrics = [];
    
    // System metrics
    const memoryUsage = process.memoryUsage();
    metrics.push(`nodejs_heap_size_used_bytes ${memoryUsage.heapUsed}`);
    metrics.push(`nodejs_heap_size_total_bytes ${memoryUsage.heapTotal}`);
    metrics.push(`nodejs_external_memory_bytes ${memoryUsage.external}`);
    metrics.push(`process_resident_memory_bytes ${memoryUsage.rss}`);
    metrics.push(`nodejs_process_uptime_seconds ${process.uptime()}`);

    // Connection metrics
    if (connectionManager) {
      try {
        const stats = await connectionManager.getConnectionStats();
        metrics.push(`realtime_connections_total ${stats.totalConnections}`);
        metrics.push(`realtime_connections_active ${stats.activeConnections}`);
        metrics.push(`realtime_connections_reconnecting ${stats.reconnectingConnections}`);
        metrics.push(`realtime_unique_users ${stats.uniqueUsers}`);
        metrics.push(`realtime_average_session_duration_seconds ${stats.averageSessionDuration}`);
      } catch (error) {
        // Skip connection metrics if unavailable
      }
    }

    // Fallback service metrics
    if (fallbackService) {
      try {
        const stats = fallbackService.getFallbackStats();
        metrics.push(`realtime_sse_connections ${stats.sseConnections}`);
        metrics.push(`realtime_polling_connections ${stats.pollingConnections}`);
        metrics.push(`realtime_active_polling_requests ${stats.activePollingRequests}`);
        metrics.push(`realtime_queued_messages_total ${stats.totalQueuedMessages}`);
      } catch (error) {
        // Skip fallback metrics if unavailable
      }
    }

    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(metrics.join('\n') + '\n');
  } catch (error) {
    res.status(500).send(`# Error generating metrics: ${error.message}\n`);
  }
});

export { router as healthRoutes };