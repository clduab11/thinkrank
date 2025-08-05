import { Server as SocketIOServer, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { logger } from '@thinkrank/shared';
import { v4 as uuidv4 } from 'uuid';
import { RedisManager } from './redis.service';
import { EventBroker } from './event-broker.service';
import { ConnectionManager } from './connection.service';
import { GameStateManager } from './game-state.service';
import { RateLimitManager } from './rate-limit.service';
import { AuthenticationService } from './auth.service';

export interface SocketUser {
  id: string;
  username: string;
  gameSession?: string;
  subscriptions: Set<string>;
  lastActivity: Date;
  connectionState: 'connected' | 'reconnecting' | 'disconnected';
  // Performance tracking
  messagesSent: number;
  messagesReceived: number;
  bytesTransferred: number;
  averageLatency: number;
  connectionQuality: number;
}

export class WebSocketManager {
  private gameStateManager: GameStateManager;
  private rateLimitManager: RateLimitManager;
  private authService: AuthenticationService;
  private connections = new Map<string, SocketUser>();
  private roomSubscriptions = new Map<string, Set<string>>();
  
  // Performance optimization fields
  private messageBatchQueue = new Map<string, any[]>();
  private batchProcessor?: NodeJS.Timeout;
  private readonly BATCH_INTERVAL = 50; // 50ms batching
  private readonly MAX_BATCH_SIZE = 20;
  private compressionEnabled = true;
  private performanceMetrics = {
    totalMessages: 0,
    totalBatches: 0,
    compressionRatio: 0,
    averageLatency: 0
  };

  constructor(
    private io: SocketIOServer,
    private redisManager: RedisManager,
    private eventBroker: EventBroker,
    private connectionManager: ConnectionManager
  ) {
    this.gameStateManager = new GameStateManager(redisManager);
    this.rateLimitManager = new RateLimitManager(redisManager);
    this.authService = new AuthenticationService();
  }

  async initialize(): Promise<void> {
    // Setup Redis adapter for clustering
    const pubClient = this.redisManager.getPubClient();
    const subClient = this.redisManager.getSubClient();
    
    this.io.adapter(createAdapter(pubClient, subClient));

    // Setup connection handlers
    this.io.on('connection', this.handleConnection.bind(this));

    // Setup event broker listeners
    await this.setupEventListeners();

    // Setup cleanup intervals
    this.setupCleanupIntervals();
    
    // Initialize performance optimization systems
    this.initializePerformanceOptimizations();

    logger.info('WebSocket manager initialized with Redis clustering and performance optimizations');
  }

  private async handleConnection(socket: Socket): Promise<void> {
    const clientId = socket.id;
    const clientIP = socket.handshake.address;

    try {
      // Rate limiting
      const allowed = await this.rateLimitManager.checkRateLimit(clientIP, 'connection');
      if (!allowed) {
        logger.warn(`Connection rate limit exceeded for IP: ${clientIP}`);
        socket.emit('error', { message: 'Connection rate limit exceeded' });
        socket.disconnect(true);
        return;
      }

      // Authentication
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      const user = await this.authService.authenticateSocket(token as string);
      
      if (!user) {
        logger.warn(`Unauthenticated connection attempt from IP: ${clientIP}`);
        socket.emit('auth_error', { message: 'Authentication required' });
        socket.disconnect(true);
        return;
      }

      // Initialize user connection with performance tracking
      const socketUser: SocketUser = {
        id: user.id,
        username: user.username,
        subscriptions: new Set(),
        lastActivity: new Date(),
        connectionState: 'connected',
        messagesSent: 0,
        messagesReceived: 0,
        bytesTransferred: 0,
        averageLatency: 0,
        connectionQuality: 100
      };

      this.connections.set(clientId, socketUser);
      await this.connectionManager.addConnection(clientId, socketUser);

      logger.info(`User ${user.username} connected with socket ${clientId}`);

      // Setup socket event handlers
      this.setupSocketHandlers(socket, socketUser);

      // Join user to personal room
      await socket.join(`user:${user.id}`);

      // Emit connection success
      socket.emit('connected', {
        userId: user.id,
        username: user.username,
        timestamp: new Date().toISOString()
      });

      // Broadcast user online status
      this.broadcastUserStatus(user.id, 'online');

    } catch (error) {
      logger.error(`Connection error for socket ${clientId}:`, error);
      socket.emit('error', { message: 'Connection failed' });
      socket.disconnect(true);
    }
  }

  private setupSocketHandlers(socket: Socket, user: SocketUser): void {
    // Game state synchronization
    socket.on('join_game', async (data) => {
      await this.handleJoinGame(socket, user, data);
    });

    socket.on('leave_game', async (data) => {
      await this.handleLeaveGame(socket, user, data);
    });

    socket.on('game_action', async (data) => {
      await this.handleGameAction(socket, user, data);
    });

    // Real-time messaging
    socket.on('send_message', async (data) => {
      await this.handleSendMessage(socket, user, data);
    });

    // Subscriptions
    socket.on('subscribe', async (data) => {
      await this.handleSubscribe(socket, user, data);
    });

    socket.on('unsubscribe', async (data) => {
      await this.handleUnsubscribe(socket, user, data);
    });

    // Heartbeat for connection monitoring with latency tracking
    socket.on('ping', (data) => {
      const now = new Date();
      user.lastActivity = now;
      
      // Calculate latency if timestamp provided
      if (data && data.timestamp) {
        const latency = now.getTime() - new Date(data.timestamp).getTime();
        user.averageLatency = (user.averageLatency * 0.9) + (latency * 0.1); // Moving average
        
        // Update connection quality based on latency
        if (latency > 200) {
          user.connectionQuality = Math.max(25, user.connectionQuality - 5);
        } else if (latency < 50) {
          user.connectionQuality = Math.min(100, user.connectionQuality + 2);
        }
      }
      
      socket.emit('pong', { timestamp: now.toISOString(), latency: user.averageLatency });
    });

    // Handle disconnection
    socket.on('disconnect', async (reason) => {
      await this.handleDisconnection(socket, user, reason);
    });

    // Handle reconnection
    socket.on('reconnecting', () => {
      user.connectionState = 'reconnecting';
      logger.info(`User ${user.username} reconnecting...`);
    });

    socket.on('reconnect', async () => {
      user.connectionState = 'connected';
      user.lastActivity = new Date();
      logger.info(`User ${user.username} reconnected`);
      
      // Restore subscriptions and game state
      await this.restoreConnectionState(socket, user);
    });
  }

  private async handleJoinGame(socket: Socket, user: SocketUser, data: any): Promise<void> {
    try {
      const { gameId, gameType } = data;

      // Validate game session
      if (!gameId || !gameType) {
        socket.emit('game_error', { message: 'Invalid game data' });
        return;
      }

      // Check rate limiting
      const allowed = await this.rateLimitManager.checkRateLimit(user.id, 'join_game');
      if (!allowed) {
        socket.emit('game_error', { message: 'Join game rate limit exceeded' });
        return;
      }

      // Join game room
      await socket.join(`game:${gameId}`);
      user.gameSession = gameId;

      // Update game state
      await this.gameStateManager.addPlayerToGame(gameId, user.id, user.username);

      // Broadcast to other players
      socket.to(`game:${gameId}`).emit('player_joined', {
        userId: user.id,
        username: user.username,
        timestamp: new Date().toISOString()
      });

      // Send current game state to new player
      const gameState = await this.gameStateManager.getGameState(gameId);
      socket.emit('game_state', gameState);

      logger.info(`User ${user.username} joined game ${gameId}`);

    } catch (error) {
      logger.error(`Error handling join game:`, error);
      socket.emit('game_error', { message: 'Failed to join game' });
    }
  }

  private async handleLeaveGame(socket: Socket, user: SocketUser, data: any): Promise<void> {
    try {
      const gameId = data.gameId || user.gameSession;
      
      if (!gameId) {
        return;
      }

      // Leave game room
      await socket.leave(`game:${gameId}`);

      // Update game state
      await this.gameStateManager.removePlayerFromGame(gameId, user.id);

      // Broadcast to other players
      socket.to(`game:${gameId}`).emit('player_left', {
        userId: user.id,
        username: user.username,
        timestamp: new Date().toISOString()
      });

      user.gameSession = undefined;

      logger.info(`User ${user.username} left game ${gameId}`);

    } catch (error) {
      logger.error(`Error handling leave game:`, error);
    }
  }

  private async handleGameAction(socket: Socket, user: SocketUser, data: any): Promise<void> {
    try {
      const { gameId, action, payload } = data;

      if (!gameId || !action) {
        socket.emit('game_error', { message: 'Invalid game action' });
        return;
      }

      // Check rate limiting
      const allowed = await this.rateLimitManager.checkRateLimit(user.id, 'game_action');
      if (!allowed) {
        socket.emit('game_error', { message: 'Game action rate limit exceeded' });
        return;
      }

      // Process game action
      const result = await this.gameStateManager.processGameAction(gameId, user.id, action, payload);

      if (result.success) {
        // Broadcast action to game room with batching optimization
        const actionResult = {
          userId: user.id,
          action,
          result: result.data,
          timestamp: new Date().toISOString()
        };
        
        this.sendOptimized(`game:${gameId}`, 'game_action_result', actionResult);

        // Publish event for other services
        await this.eventBroker.publishEvent('game.action', {
          gameId,
          userId: user.id,
          action,
          result: result.data
        });
      } else {
        socket.emit('game_error', { message: result.error });
      }

    } catch (error) {
      logger.error(`Error handling game action:`, error);
      socket.emit('game_error', { message: 'Failed to process game action' });
    }
  }

  private async handleSendMessage(socket: Socket, user: SocketUser, data: any): Promise<void> {
    try {
      const { target, type, message } = data;

      if (!target || !type || !message) {
        socket.emit('message_error', { message: 'Invalid message data' });
        return;
      }

      // Check rate limiting
      const allowed = await this.rateLimitManager.checkRateLimit(user.id, 'send_message');
      if (!allowed) {
        socket.emit('message_error', { message: 'Message rate limit exceeded' });
        return;
      }

      const messageData = {
        id: uuidv4(),
        from: user.id,
        fromUsername: user.username,
        message,
        timestamp: new Date().toISOString()
      };

      // Send to target room/user with optimization
      if (type === 'game' && user.gameSession) {
        this.sendOptimized(`game:${user.gameSession}`, 'game_message', messageData);
      } else if (type === 'direct') {
        this.sendOptimized(`user:${target}`, 'direct_message', messageData);
      }
      
      // Update user metrics
      user.messagesSent++;
      user.bytesTransferred += JSON.stringify(messageData).length;

      // Store message in Redis for history
      await this.redisManager.storeMessage(type, target, messageData);

    } catch (error) {
      logger.error(`Error handling send message:`, error);
      socket.emit('message_error', { message: 'Failed to send message' });
    }
  }

  private async handleSubscribe(socket: Socket, user: SocketUser, data: any): Promise<void> {
    try {
      const { channel } = data;

      if (!channel) {
        return;
      }

      await socket.join(channel);
      user.subscriptions.add(channel);

      // Track room subscriptions
      if (!this.roomSubscriptions.has(channel)) {
        this.roomSubscriptions.set(channel, new Set());
      }
      this.roomSubscriptions.get(channel)!.add(socket.id);

      socket.emit('subscribed', { channel });

    } catch (error) {
      logger.error(`Error handling subscribe:`, error);
    }
  }

  private async handleUnsubscribe(socket: Socket, user: SocketUser, data: any): Promise<void> {
    try {
      const { channel } = data;

      if (!channel) {
        return;
      }

      await socket.leave(channel);
      user.subscriptions.delete(channel);

      // Update room subscriptions
      const roomSubs = this.roomSubscriptions.get(channel);
      if (roomSubs) {
        roomSubs.delete(socket.id);
        if (roomSubs.size === 0) {
          this.roomSubscriptions.delete(channel);
        }
      }

      socket.emit('unsubscribed', { channel });

    } catch (error) {
      logger.error(`Error handling unsubscribe:`, error);
    }
  }

  private async handleDisconnection(socket: Socket, user: SocketUser, reason: string): Promise<void> {
    try {
      logger.info(`User ${user.username} disconnected: ${reason}`);

      // Clean up connections
      this.connections.delete(socket.id);
      await this.connectionManager.removeConnection(socket.id);

      // Leave game if in one
      if (user.gameSession) {
        await this.gameStateManager.removePlayerFromGame(user.gameSession, user.id);
        socket.to(`game:${user.gameSession}`).emit('player_left', {
          userId: user.id,
          username: user.username,
          reason: 'disconnect',
          timestamp: new Date().toISOString()
        });
      }

      // Clean up room subscriptions
      user.subscriptions.forEach(channel => {
        const roomSubs = this.roomSubscriptions.get(channel);
        if (roomSubs) {
          roomSubs.delete(socket.id);
          if (roomSubs.size === 0) {
            this.roomSubscriptions.delete(channel);
          }
        }
      });

      // Broadcast user offline status
      this.broadcastUserStatus(user.id, 'offline');

    } catch (error) {
      logger.error(`Error handling disconnection:`, error);
    }
  }

  private async restoreConnectionState(socket: Socket, user: SocketUser): Promise<void> {
    try {
      // Restore game session if exists
      if (user.gameSession) {
        await socket.join(`game:${user.gameSession}`);
        const gameState = await this.gameStateManager.getGameState(user.gameSession);
        socket.emit('game_state', gameState);
      }

      // Restore subscriptions
      for (const channel of user.subscriptions) {
        await socket.join(channel);
      }

      socket.emit('connection_restored', { timestamp: new Date().toISOString() });

    } catch (error) {
      logger.error(`Error restoring connection state:`, error);
    }
  }

  private async setupEventListeners(): Promise<void> {
    // Listen for events from other services
    await this.eventBroker.subscribe('user.status', (data) => {
      this.broadcastUserStatus(data.userId, data.status);
    });

    await this.eventBroker.subscribe('game.update', (data) => {
      this.io.to(`game:${data.gameId}`).emit('game_update', data);
    });

    await this.eventBroker.subscribe('system.announcement', (data) => {
      this.io.emit('system_announcement', data);
    });
  }

  private setupCleanupIntervals(): void {
    // Clean up inactive connections every 5 minutes
    setInterval(async () => {
      const now = new Date();
      const inactiveThreshold = 10 * 60 * 1000; // 10 minutes

      for (const [socketId, user] of this.connections) {
        if (now.getTime() - user.lastActivity.getTime() > inactiveThreshold) {
          logger.info(`Cleaning up inactive connection for user ${user.username}`);
          const socket = this.io.sockets.sockets.get(socketId);
          if (socket) {
            socket.disconnect(true);
          }
        }
      }
    }, 5 * 60 * 1000);
  }

  private broadcastUserStatus(userId: string, status: 'online' | 'offline'): void {
    this.io.emit('user_status', {
      userId,
      status,
      timestamp: new Date().toISOString()
    });
  }

  // Performance Optimization Methods
  private initializePerformanceOptimizations(): void {
    // Start message batching processor
    this.batchProcessor = setInterval(() => {
      this.processBatchedMessages();
    }, this.BATCH_INTERVAL);
    
    // Performance monitoring
    setInterval(() => {
      this.logPerformanceMetrics();
    }, 60000); // Every minute
    
    logger.info('Performance optimization systems initialized');
  }

  private sendOptimized(room: string, event: string, data: any): void {
    const message = {
      room,
      event,
      data,
      timestamp: Date.now(),
      size: JSON.stringify(data).length
    };

    // Add to batch queue
    if (!this.messageBatchQueue.has(room)) {
      this.messageBatchQueue.set(room, []);
    }

    const roomQueue = this.messageBatchQueue.get(room)!;
    roomQueue.push(message);

    // Process immediately if batch is full
    if (roomQueue.length >= this.MAX_BATCH_SIZE) {
      this.processBatchForRoom(room);
    }
  }

  private processBatchedMessages(): void {
    for (const [room, messages] of this.messageBatchQueue.entries()) {
      if (messages.length > 0) {
        this.processBatchForRoom(room);
      }
    }
  }

  private processBatchForRoom(room: string): void {
    const messages = this.messageBatchQueue.get(room);
    if (!messages || messages.length === 0) return;

    try {
      if (messages.length === 1) {
        // Single message - send directly
        const msg = messages[0];
        this.io.to(msg.room).emit(msg.event, msg.data);
        this.performanceMetrics.totalMessages++;
      } else {
        // Multiple messages - send as batch
        const batchData = {
          type: 'batch',
          messages: messages.map(msg => ({
            event: msg.event,
            data: msg.data,
            timestamp: msg.timestamp
          })),
          batchId: uuidv4(),
          timestamp: Date.now()
        };

        this.io.to(room).emit('message_batch', batchData);
        this.performanceMetrics.totalBatches++;
        this.performanceMetrics.totalMessages += messages.length;
        
        // Calculate compression ratio
        const originalSize = messages.reduce((sum, msg) => sum + msg.size, 0);
        const batchSize = JSON.stringify(batchData).length;
        this.performanceMetrics.compressionRatio = batchSize / originalSize;

        logger.debug(`Sent batch of ${messages.length} messages to ${room}, compression: ${(this.performanceMetrics.compressionRatio * 100).toFixed(1)}%`);
      }

      // Clear processed messages
      this.messageBatchQueue.set(room, []);

    } catch (error) {
      logger.error(`Error processing batch for room ${room}:`, error);
      
      // Fallback: send messages individually
      messages.forEach(msg => {
        try {
          this.io.to(msg.room).emit(msg.event, msg.data);
        } catch (fallbackError) {
          logger.error(`Fallback send failed:`, fallbackError);
        }
      });
      
      this.messageBatchQueue.set(room, []);
    }
  }

  private logPerformanceMetrics(): void {
    const connectionCount = this.connections.size;
    const avgLatency = Array.from(this.connections.values())
      .reduce((sum, user) => sum + user.averageLatency, 0) / connectionCount || 0;

    const avgConnectionQuality = Array.from(this.connections.values())
      .reduce((sum, user) => sum + user.connectionQuality, 0) / connectionCount || 100;

    logger.info('WebSocket Performance Metrics:', {
      connections: connectionCount,
      totalMessages: this.performanceMetrics.totalMessages,
      totalBatches: this.performanceMetrics.totalBatches,
      avgCompressionRatio: (this.performanceMetrics.compressionRatio * 100).toFixed(1) + '%',
      avgLatency: avgLatency.toFixed(1) + 'ms',
      avgConnectionQuality: avgConnectionQuality.toFixed(1) + '%',
      batchEfficiency: this.performanceMetrics.totalBatches > 0 
        ? (this.performanceMetrics.totalMessages / this.performanceMetrics.totalBatches).toFixed(1) + ' msgs/batch'
        : '0'
    });
  }

  private optimizeConnectionForUser(user: SocketUser, socket: Socket): void {
    // Adjust batching based on connection quality
    if (user.connectionQuality < 50) {
      // Poor connection - increase batching to reduce overhead
      logger.info(`Optimizing connection for user ${user.username} (quality: ${user.connectionQuality}%)`);
      
      // Could implement per-user batching intervals here
      // For now, we rely on the global batching system
    }
  }

  // Public methods for external use
  public async sendToUser(userId: string, event: string, data: any): Promise<void> {
    this.io.to(`user:${userId}`).emit(event, data);
  }

  public async sendToGame(gameId: string, event: string, data: any): Promise<void> {
    this.io.to(`game:${gameId}`).emit(event, data);
  }

  public async broadcastToAll(event: string, data: any): Promise<void> {
    this.io.emit(event, data);
  }

  public getConnectionCount(): number {
    return this.connections.size;
  }

  public getActiveGames(): string[] {
    const games = new Set<string>();
    for (const user of this.connections.values()) {
      if (user.gameSession) {
        games.add(user.gameSession);
      }
    }
    return Array.from(games);
  }

  // Enhanced public methods with optimization
  public async sendToUserOptimized(userId: string, event: string, data: any): Promise<void> {
    this.sendOptimized(`user:${userId}`, event, data);
  }

  public async sendToGameOptimized(gameId: string, event: string, data: any): Promise<void> {
    this.sendOptimized(`game:${gameId}`, event, data);
  }

  public getPerformanceMetrics() {
    const connectionCount = this.connections.size;
    const userMetrics = Array.from(this.connections.values()).map(user => ({
      id: user.id,
      username: user.username,
      latency: user.averageLatency,
      quality: user.connectionQuality,
      messagesSent: user.messagesSent,
      messagesReceived: user.messagesReceived,
      bytesTransferred: user.bytesTransferred
    }));

    return {
      connections: connectionCount,
      batchMetrics: this.performanceMetrics,
      userMetrics,
      averageLatency: userMetrics.reduce((sum, user) => sum + user.latency, 0) / connectionCount || 0,
      averageQuality: userMetrics.reduce((sum, user) => sum + user.quality, 0) / connectionCount || 100
    };
  }

  public cleanup(): void {
    if (this.batchProcessor) {
      clearInterval(this.batchProcessor);
    }
    
    // Process any remaining batched messages before shutdown
    this.processBatchedMessages();
    
    logger.info('WebSocket performance systems cleaned up');
  }
}