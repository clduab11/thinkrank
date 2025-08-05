import { RedisManager } from './redis.service';
import { EventBroker } from './event-broker.service';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@thinkrank/shared';

export interface ConnectionState {
  socketId: string;
  userId: string;
  username: string;
  sessionId: string;
  joinedAt: Date;
  lastActivity: Date;
  status: 'connected' | 'reconnecting' | 'disconnected';
  metadata: {
    userAgent?: string;
    ipAddress?: string;
    location?: string;
    deviceType?: 'mobile' | 'desktop' | 'tablet';
  };
  subscriptions: string[];
  gameSession?: string;
}

export interface SessionRecoveryData {
  userId: string;
  gameSession?: string;
  subscriptions: string[];
  lastState: any;
  timestamp: Date;
}

export class ConnectionManager {
  private activeConnections = new Map<string, ConnectionState>();
  private userSessions = new Map<string, Set<string>>(); // userId -> socketIds
  private sessionRecovery = new Map<string, SessionRecoveryData>(); // sessionId -> recovery data

  constructor(
    private redisManager?: RedisManager,
    private eventBroker?: EventBroker
  ) {}

  async addConnection(socketId: string, connectionData: {
    userId: string;
    username: string;
    sessionId?: string;
    metadata?: any;
  }): Promise<ConnectionState> {
    const sessionId = connectionData.sessionId || uuidv4();
    
    const connectionState: ConnectionState = {
      socketId,
      userId: connectionData.userId,
      username: connectionData.username,
      sessionId,
      joinedAt: new Date(),
      lastActivity: new Date(),
      status: 'connected',
      metadata: connectionData.metadata || {},
      subscriptions: [],
      gameSession: undefined
    };

    // Store in memory
    this.activeConnections.set(socketId, connectionState);

    // Track user sessions
    if (!this.userSessions.has(connectionData.userId)) {
      this.userSessions.set(connectionData.userId, new Set());
    }
    this.userSessions.get(connectionData.userId)!.add(socketId);

    // Store in Redis for persistence across instances
    if (this.redisManager) {
      await this.redisManager.setConnectionState(socketId, connectionState);
      await this.redisManager.sadd(`user:${connectionData.userId}:connections`, socketId);
      await this.redisManager.set(`session:${sessionId}`, connectionState, 24 * 60 * 60); // 24 hours
    }

    // Publish connection event
    if (this.eventBroker) {
      await this.eventBroker.publishUserEvent(connectionData.userId, 'connected', {
        socketId,
        sessionId,
        timestamp: connectionState.joinedAt
      });
    }

    logger.info(`Connection added: ${socketId} for user ${connectionData.username}`);
    return connectionState;
  }

  async removeConnection(socketId: string): Promise<void> {
    const connection = this.activeConnections.get(socketId);
    if (!connection) {
      return;
    }

    // Store recovery data before removing
    const recoveryData: SessionRecoveryData = {
      userId: connection.userId,
      gameSession: connection.gameSession,
      subscriptions: connection.subscriptions,
      lastState: this.extractLastState(connection),
      timestamp: new Date()
    };

    this.sessionRecovery.set(connection.sessionId, recoveryData);

    // Remove from memory
    this.activeConnections.delete(socketId);

    // Update user sessions
    const userSockets = this.userSessions.get(connection.userId);
    if (userSockets) {
      userSockets.delete(socketId);
      if (userSockets.size === 0) {
        this.userSessions.delete(connection.userId);
      }
    }

    // Update Redis
    if (this.redisManager) {
      await this.redisManager.removeConnectionState(socketId);
      await this.redisManager.srem(`user:${connection.userId}:connections`, socketId);
      
      // Store recovery data with TTL
      await this.redisManager.set(
        `recovery:${connection.sessionId}`, 
        recoveryData, 
        60 * 60 // 1 hour
      );
    }

    // Publish disconnection event
    if (this.eventBroker) {
      await this.eventBroker.publishUserEvent(connection.userId, 'disconnected', {
        socketId,
        sessionId: connection.sessionId,
        duration: new Date().getTime() - connection.joinedAt.getTime()
      });
    }

    logger.info(`Connection removed: ${socketId}`);
  }

  async updateConnectionActivity(socketId: string): Promise<void> {
    const connection = this.activeConnections.get(socketId);
    if (!connection) {
      return;
    }

    connection.lastActivity = new Date();
    connection.status = 'connected';

    // Update in Redis
    if (this.redisManager) {
      await this.redisManager.setConnectionState(socketId, connection);
    }
  }

  async updateConnectionStatus(socketId: string, status: ConnectionState['status']): Promise<void> {
    const connection = this.activeConnections.get(socketId);
    if (!connection) {
      return;
    }

    const oldStatus = connection.status;
    connection.status = status;
    connection.lastActivity = new Date();

    // Update in Redis
    if (this.redisManager) {
      await this.redisManager.setConnectionState(socketId, connection);
    }

    // Publish status change event
    if (this.eventBroker && oldStatus !== status) {
      await this.eventBroker.publishUserEvent(connection.userId, 'status_changed', {
        socketId,
        oldStatus,
        newStatus: status,
        timestamp: new Date()
      });
    }
  }

  async addSubscription(socketId: string, subscription: string): Promise<void> {
    const connection = this.activeConnections.get(socketId);
    if (!connection) {
      return;
    }

    if (!connection.subscriptions.includes(subscription)) {
      connection.subscriptions.push(subscription);

      // Update in Redis
      if (this.redisManager) {
        await this.redisManager.setConnectionState(socketId, connection);
      }
    }
  }

  async removeSubscription(socketId: string, subscription: string): Promise<void> {
    const connection = this.activeConnections.get(socketId);
    if (!connection) {
      return;
    }

    const index = connection.subscriptions.indexOf(subscription);
    if (index > -1) {
      connection.subscriptions.splice(index, 1);

      // Update in Redis
      if (this.redisManager) {
        await this.redisManager.setConnectionState(socketId, connection);
      }
    }
  }

  async setGameSession(socketId: string, gameId: string | undefined): Promise<void> {
    const connection = this.activeConnections.get(socketId);
    if (!connection) {
      return;
    }

    connection.gameSession = gameId;

    // Update in Redis
    if (this.redisManager) {
      await this.redisManager.setConnectionState(socketId, connection);
    }
  }

  async getConnection(socketId: string): Promise<ConnectionState | null> {
    // Try memory first
    const connection = this.activeConnections.get(socketId);
    if (connection) {
      return connection;
    }

    // Try Redis if available
    if (this.redisManager) {
      return await this.redisManager.getConnectionState(socketId);
    }

    return null;
  }

  async getUserConnections(userId: string): Promise<ConnectionState[]> {
    const connections: ConnectionState[] = [];

    // Get from memory
    const socketIds = this.userSessions.get(userId);
    if (socketIds) {
      for (const socketId of socketIds) {
        const connection = this.activeConnections.get(socketId);
        if (connection) {
          connections.push(connection);
        }
      }
    }

    // Get from Redis if available and no memory connections
    if (connections.length === 0 && this.redisManager) {
      const socketIds = await this.redisManager.smembers(`user:${userId}:connections`);
      for (const socketId of socketIds) {
        const connection = await this.redisManager.getConnectionState(socketId);
        if (connection) {
          connections.push(connection);
        }
      }
    }

    return connections;
  }

  async getActiveUsers(): Promise<string[]> {
    const activeUsers = new Set<string>();

    // From memory
    for (const connection of this.activeConnections.values()) {
      if (connection.status === 'connected') {
        activeUsers.add(connection.userId);
      }
    }

    return Array.from(activeUsers);
  }

  async getConnectionStats(): Promise<{
    totalConnections: number;
    activeConnections: number;
    reconnectingConnections: number;
    uniqueUsers: number;
    averageSessionDuration: number;
  }> {
    const connections = Array.from(this.activeConnections.values());
    const activeConnections = connections.filter(c => c.status === 'connected').length;
    const reconnectingConnections = connections.filter(c => c.status === 'reconnecting').length;
    const uniqueUsers = new Set(connections.map(c => c.userId)).size;

    const now = new Date();
    const totalDuration = connections.reduce((sum, c) => 
      sum + (now.getTime() - c.joinedAt.getTime()), 0
    );
    const averageSessionDuration = connections.length > 0 ? totalDuration / connections.length : 0;

    return {
      totalConnections: connections.length,
      activeConnections,
      reconnectingConnections,
      uniqueUsers,
      averageSessionDuration: Math.round(averageSessionDuration / 1000) // in seconds
    };
  }

  async recoverSession(sessionId: string): Promise<SessionRecoveryData | null> {
    // Try memory first
    const recoveryData = this.sessionRecovery.get(sessionId);
    if (recoveryData) {
      return recoveryData;
    }

    // Try Redis
    if (this.redisManager) {
      const data = await this.redisManager.get<SessionRecoveryData>(`recovery:${sessionId}`);
      if (data) {
        // Cache in memory
        this.sessionRecovery.set(sessionId, data);
        return data;
      }
    }

    return null;
  }

  async cleanupInactiveConnections(inactiveThresholdMs: number = 10 * 60 * 1000): Promise<number> {
    const now = new Date();
    const inactiveConnections: string[] = [];

    for (const [socketId, connection] of this.activeConnections) {
      if (now.getTime() - connection.lastActivity.getTime() > inactiveThresholdMs) {
        inactiveConnections.push(socketId);
      }
    }

    // Remove inactive connections
    for (const socketId of inactiveConnections) {
      await this.removeConnection(socketId);
    }

    if (inactiveConnections.length > 0) {
      logger.info(`Cleaned up ${inactiveConnections.length} inactive connections`);
    }

    return inactiveConnections.length;
  }

  async cleanupExpiredRecoveryData(expirationMs: number = 60 * 60 * 1000): Promise<void> {
    const now = new Date();
    const expiredSessions: string[] = [];

    for (const [sessionId, recoveryData] of this.sessionRecovery) {
      if (now.getTime() - recoveryData.timestamp.getTime() > expirationMs) {
        expiredSessions.push(sessionId);
      }
    }

    // Remove expired recovery data
    for (const sessionId of expiredSessions) {
      this.sessionRecovery.delete(sessionId);
      
      if (this.redisManager) {
        await this.redisManager.del(`recovery:${sessionId}`);
      }
    }

    if (expiredSessions.length > 0) {
      logger.info(`Cleaned up ${expiredSessions.length} expired session recovery entries`);
    }
  }

  // Fallback mechanism support
  async registerFallbackConnection(userId: string, connectionType: 'sse' | 'polling', connectionId: string): Promise<void> {
    const fallbackKey = `fallback:${userId}:${connectionType}`;
    
    if (this.redisManager) {
      await this.redisManager.set(fallbackKey, {
        connectionId,
        type: connectionType,
        timestamp: new Date(),
        userId
      }, 60 * 60); // 1 hour TTL
    }

    logger.info(`Registered fallback ${connectionType} connection for user ${userId}`);
  }

  async getFallbackConnections(userId: string): Promise<Array<{ type: 'sse' | 'polling'; connectionId: string; timestamp: Date }>> {
    if (!this.redisManager) {
      return [];
    }

    const fallbackConnections: Array<{ type: 'sse' | 'polling'; connectionId: string; timestamp: Date }> = [];

    // Check SSE
    const sseConnection = await this.redisManager.get<any>(`fallback:${userId}:sse`);
    if (sseConnection) {
      fallbackConnections.push({
        type: 'sse',
        connectionId: sseConnection.connectionId,
        timestamp: new Date(sseConnection.timestamp)
      });
    }

    // Check polling
    const pollingConnection = await this.redisManager.get<any>(`fallback:${userId}:polling`);
    if (pollingConnection) {
      fallbackConnections.push({
        type: 'polling',
        connectionId: pollingConnection.connectionId,
        timestamp: new Date(pollingConnection.timestamp)
      });
    }

    return fallbackConnections;
  }

  private extractLastState(connection: ConnectionState): any {
    return {
      subscriptions: connection.subscriptions,
      gameSession: connection.gameSession,
      lastActivity: connection.lastActivity,
      status: connection.status
    };
  }

  // Health monitoring
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      activeConnections: number;
      memoryUsage: number;
      redisConnected: boolean;
      averageResponseTime: number;
    };
  }> {
    const stats = await this.getConnectionStats();
    const memoryUsage = process.memoryUsage();
    
    let redisConnected = false;
    if (this.redisManager) {
      try {
        await this.redisManager.getMainClient().ping();
        redisConnected = true;
      } catch (error) {
        logger.warn('Redis health check failed:', error);
      }
    }

    const status = this.determineHealthStatus(stats, redisConnected);

    return {
      status,
      details: {
        activeConnections: stats.activeConnections,
        memoryUsage: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        redisConnected,
        averageResponseTime: 0 // Would need to implement response time tracking
      }
    };
  }

  private determineHealthStatus(stats: any, redisConnected: boolean): 'healthy' | 'degraded' | 'unhealthy' {
    if (!redisConnected) {
      return 'unhealthy';
    }

    if (stats.totalConnections > 10000) {
      return 'degraded';
    }

    return 'healthy';
  }
}