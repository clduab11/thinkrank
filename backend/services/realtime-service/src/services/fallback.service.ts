import { Request, Response } from 'express';
import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import { RedisManager } from './redis.service';
import { ConnectionManager } from './connection.service';
import { logger } from '@thinkrank/shared';

export interface SSEConnection {
  id: string;
  userId: string;
  response: Response;
  lastActivity: Date;
  subscriptions: Set<string>;
}

export interface PollingConnection {
  id: string;
  userId: string;
  lastPoll: Date;
  messageQueue: any[];
  subscriptions: Set<string>;
}

export class FallbackService extends EventEmitter {
  private sseConnections = new Map<string, SSEConnection>();
  private pollingConnections = new Map<string, PollingConnection>();
  private pollingTimeouts = new Map<string, NodeJS.Timeout>();

  constructor(
    private redisManager: RedisManager,
    private connectionManager: ConnectionManager
  ) {
    super();
    this.setupCleanupInterval();
  }

  // Server-Sent Events (SSE) Implementation
  async handleSSEConnection(req: Request, res: Response, userId: string): Promise<void> {
    const connectionId = uuidv4();

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial connection event
    this.sendSSEMessage(res, {
      type: 'connected',
      data: { connectionId, timestamp: new Date().toISOString() }
    });

    // Create SSE connection
    const sseConnection: SSEConnection = {
      id: connectionId,
      userId,
      response: res,
      lastActivity: new Date(),
      subscriptions: new Set()
    };

    this.sseConnections.set(connectionId, sseConnection);

    // Register with connection manager
    await this.connectionManager.registerFallbackConnection(userId, 'sse', connectionId);

    // Setup heartbeat
    const heartbeatInterval = setInterval(() => {
      if (this.sseConnections.has(connectionId)) {
        this.sendSSEMessage(res, {
          type: 'heartbeat',
          data: { timestamp: new Date().toISOString() }
        });
      } else {
        clearInterval(heartbeatInterval);
      }
    }, 30000); // 30 seconds

    // Handle client disconnect
    req.on('close', () => {
      this.removeSSEConnection(connectionId);
      clearInterval(heartbeatInterval);
    });

    req.on('error', (error) => {
      logger.error(`SSE connection error for user ${userId}:`, error);
      this.removeSSEConnection(connectionId);
      clearInterval(heartbeatInterval);
    });

    logger.info(`SSE connection established for user ${userId}: ${connectionId}`);
  }

  private sendSSEMessage(res: Response, message: { type: string; data: any }): void {
    try {
      res.write(`event: ${message.type}\n`);
      res.write(`data: ${JSON.stringify(message.data)}\n\n`);
    } catch (error) {
      logger.error('Error sending SSE message:', error);
    }
  }

  async sendToSSEConnection(connectionId: string, event: string, data: any): Promise<boolean> {
    const connection = this.sseConnections.get(connectionId);
    if (!connection) {
      return false;
    }

    try {
      this.sendSSEMessage(connection.response, { type: event, data });
      connection.lastActivity = new Date();
      return true;
    } catch (error) {
      logger.error(`Error sending to SSE connection ${connectionId}:`, error);
      this.removeSSEConnection(connectionId);
      return false;
    }
  }

  async sendToUserSSE(userId: string, event: string, data: any): Promise<number> {
    let sentCount = 0;
    
    for (const connection of this.sseConnections.values()) {
      if (connection.userId === userId) {
        const sent = await this.sendToSSEConnection(connection.id, event, data);
        if (sent) sentCount++;
      }
    }

    return sentCount;
  }

  private removeSSEConnection(connectionId: string): void {
    const connection = this.sseConnections.get(connectionId);
    if (connection) {
      try {
        connection.response.end();
      } catch (error) {
        // Connection may already be closed
      }
      
      this.sseConnections.delete(connectionId);
      logger.info(`SSE connection removed: ${connectionId}`);
    }
  }

  // Long Polling Implementation
  async handlePollingConnection(req: Request, res: Response, userId: string): Promise<void> {
    const connectionId = req.query.connectionId as string || uuidv4();
    const timeout = parseInt(req.query.timeout as string) || 30000; // 30 seconds default

    let pollingConnection = this.pollingConnections.get(connectionId);
    
    if (!pollingConnection) {
      pollingConnection = {
        id: connectionId,
        userId,
        lastPoll: new Date(),
        messageQueue: [],
        subscriptions: new Set()
      };
      
      this.pollingConnections.set(connectionId, pollingConnection);
      await this.connectionManager.registerFallbackConnection(userId, 'polling', connectionId);
    } else {
      pollingConnection.lastPoll = new Date();
    }

    // If there are queued messages, send them immediately
    if (pollingConnection.messageQueue.length > 0) {
      const messages = pollingConnection.messageQueue.splice(0);
      res.json({
        success: true,
        messages,
        connectionId,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Set timeout for long polling
    const timeoutHandle = setTimeout(() => {
      this.pollingTimeouts.delete(connectionId);
      res.json({
        success: true,
        messages: [],
        connectionId,
        timestamp: new Date().toISOString()
      });
    }, timeout);

    this.pollingTimeouts.set(connectionId, timeoutHandle);

    // Handle client disconnect
    req.on('close', () => {
      const timeout = this.pollingTimeouts.get(connectionId);
      if (timeout) {
        clearTimeout(timeout);
        this.pollingTimeouts.delete(connectionId);
      }
    });

    // Set up one-time message listener
    const messageHandler = (message: any) => {
      const timeout = this.pollingTimeouts.get(connectionId);
      if (timeout) {
        clearTimeout(timeout);
        this.pollingTimeouts.delete(connectionId);
        
        res.json({
          success: true,
          messages: [message],
          connectionId,
          timestamp: new Date().toISOString()
        });
      }
    };

    this.once(`polling:${connectionId}`, messageHandler);

    logger.info(`Long polling request established for user ${userId}: ${connectionId}`);
  }

  async sendToPollingConnection(connectionId: string, event: string, data: any): Promise<boolean> {
    const connection = this.pollingConnections.get(connectionId);
    if (!connection) {
      return false;
    }

    const message = {
      type: event,
      data,
      timestamp: new Date().toISOString()
    };

    // Check if there's an active polling request
    if (this.pollingTimeouts.has(connectionId)) {
      // Send immediately to waiting client
      this.emit(`polling:${connectionId}`, message);
    } else {
      // Queue message for next polling request
      connection.messageQueue.push(message);
      
      // Limit queue size
      if (connection.messageQueue.length > 100) {
        connection.messageQueue.shift(); // Remove oldest message
      }
    }

    return true;
  }

  async sendToUserPolling(userId: string, event: string, data: any): Promise<number> {
    let sentCount = 0;
    
    for (const connection of this.pollingConnections.values()) {
      if (connection.userId === userId) {
        const sent = await this.sendToPollingConnection(connection.id, event, data);
        if (sent) sentCount++;
      }
    }

    return sentCount;
  }

  // Unified fallback sending
  async sendToUserFallback(userId: string, event: string, data: any): Promise<{
    sse: number;
    polling: number;
    total: number;
  }> {
    const sseCount = await this.sendToUserSSE(userId, event, data);
    const pollingCount = await this.sendToUserPolling(userId, event, data);

    return {
      sse: sseCount,
      polling: pollingCount,
      total: sseCount + pollingCount
    };
  }

  // Subscription management for fallback connections
  async subscribeSSE(connectionId: string, channel: string): Promise<boolean> {
    const connection = this.sseConnections.get(connectionId);
    if (!connection) {
      return false;
    }

    connection.subscriptions.add(channel);
    
    // Send confirmation
    this.sendSSEMessage(connection.response, {
      type: 'subscribed',
      data: { channel }
    });

    return true;
  }

  async unsubscribeSSE(connectionId: string, channel: string): Promise<boolean> {
    const connection = this.sseConnections.get(connectionId);
    if (!connection) {
      return false;
    }

    connection.subscriptions.delete(channel);
    
    // Send confirmation
    this.sendSSEMessage(connection.response, {
      type: 'unsubscribed',
      data: { channel }
    });

    return true;
  }

  async subscribePolling(connectionId: string, channel: string): Promise<boolean> {
    const connection = this.pollingConnections.get(connectionId);
    if (!connection) {
      return false;
    }

    connection.subscriptions.add(channel);
    
    // Queue subscription confirmation
    connection.messageQueue.push({
      type: 'subscribed',
      data: { channel },
      timestamp: new Date().toISOString()
    });

    return true;
  }

  async unsubscribePolling(connectionId: string, channel: string): Promise<boolean> {
    const connection = this.pollingConnections.get(connectionId);
    if (!connection) {
      return false;
    }

    connection.subscriptions.delete(channel);
    
    // Queue unsubscription confirmation
    connection.messageQueue.push({
      type: 'unsubscribed',
      data: { channel },
      timestamp: new Date().toISOString()
    });

    return true;
  }

  // Channel broadcasting for fallback connections
  async broadcastToChannel(channel: string, event: string, data: any): Promise<{
    sse: number;
    polling: number;
  }> {
    let sseCount = 0;
    let pollingCount = 0;

    // Broadcast to SSE connections
    for (const connection of this.sseConnections.values()) {
      if (connection.subscriptions.has(channel)) {
        const sent = await this.sendToSSEConnection(connection.id, event, data);
        if (sent) sseCount++;
      }
    }

    // Broadcast to polling connections
    for (const connection of this.pollingConnections.values()) {
      if (connection.subscriptions.has(channel)) {
        const sent = await this.sendToPollingConnection(connection.id, event, data);
        if (sent) pollingCount++;
      }
    }

    return { sse: sseCount, polling: pollingCount };
  }

  // Health monitoring and cleanup
  private setupCleanupInterval(): void {
    // Clean up inactive connections every 5 minutes
    setInterval(() => {
      this.cleanupInactiveConnections();
    }, 5 * 60 * 1000);
  }

  private cleanupInactiveConnections(): void {
    const now = new Date();
    const inactiveThreshold = 5 * 60 * 1000; // 5 minutes

    // Clean up SSE connections
    const inactiveSSE: string[] = [];
    for (const [connectionId, connection] of this.sseConnections) {
      if (now.getTime() - connection.lastActivity.getTime() > inactiveThreshold) {
        inactiveSSE.push(connectionId);
      }
    }

    for (const connectionId of inactiveSSE) {
      this.removeSSEConnection(connectionId);
    }

    // Clean up polling connections
    const inactivePolling: string[] = [];
    for (const [connectionId, connection] of this.pollingConnections) {
      if (now.getTime() - connection.lastPoll.getTime() > inactiveThreshold) {
        inactivePolling.push(connectionId);
      }
    }

    for (const connectionId of inactivePolling) {
      const timeout = this.pollingTimeouts.get(connectionId);
      if (timeout) {
        clearTimeout(timeout);
        this.pollingTimeouts.delete(connectionId);
      }
      this.pollingConnections.delete(connectionId);
    }

    if (inactiveSSE.length > 0 || inactivePolling.length > 0) {
      logger.info(`Cleaned up ${inactiveSSE.length} SSE and ${inactivePolling.length} polling connections`);
    }
  }

  getFallbackStats(): {
    sseConnections: number;
    pollingConnections: number;
    activePollingRequests: number;
    totalQueuedMessages: number;
  } {
    const totalQueuedMessages = Array.from(this.pollingConnections.values())
      .reduce((sum, conn) => sum + conn.messageQueue.length, 0);

    return {
      sseConnections: this.sseConnections.size,
      pollingConnections: this.pollingConnections.size,
      activePollingRequests: this.pollingTimeouts.size,
      totalQueuedMessages
    };
  }

  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
  }> {
    const stats = this.getFallbackStats();
    const memoryUsage = process.memoryUsage();

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Check for degraded performance indicators
    if (stats.totalQueuedMessages > 1000 || stats.sseConnections > 5000) {
      status = 'degraded';
    }

    // Check for unhealthy conditions
    if (memoryUsage.heapUsed > 1024 * 1024 * 500) { // 500MB
      status = 'unhealthy';
    }

    return {
      status,
      details: {
        ...stats,
        memoryUsageMB: Math.round(memoryUsage.heapUsed / 1024 / 1024)
      }
    };
  }
}