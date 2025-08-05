import { Kafka, Producer, Consumer, KafkaMessage, EachMessagePayload } from 'kafkajs';
import { connect, Connection, Channel } from 'amqplib';
import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@thinkrank/shared';
import { RedisManager } from './redis.service';

export interface DomainEvent {
  id: string;
  type: string;
  aggregateId: string;
  aggregateType: string;
  data: any;
  metadata: {
    userId?: string;
    sessionId?: string;
    timestamp: string;
    version: number;
    correlationId?: string;
    causationId?: string;
  };
}

export interface EventHandler {
  eventType: string;
  handler: (event: DomainEvent) => Promise<void> | void;
}

export class EventBroker extends EventEmitter {
  private kafka?: Kafka;
  private producer?: Producer;
  private consumer?: Consumer;
  private rabbitConnection?: Connection;
  private rabbitChannel?: Channel;
  private eventStore: EventStore;
  private eventHandlers = new Map<string, EventHandler[]>();
  private isInitialized = false;

  constructor(private redisManager: RedisManager) {
    super();
    this.eventStore = new EventStore(redisManager);
  }

  async connect(): Promise<void> {
    try {
      // Initialize based on configuration
      const brokerType = process.env.EVENT_BROKER_TYPE || 'kafka';

      if (brokerType === 'kafka') {
        await this.initializeKafka();
      } else if (brokerType === 'rabbitmq') {
        await this.initializeRabbitMQ();
      }

      await this.eventStore.initialize();
      this.isInitialized = true;

      logger.info(`Event broker initialized with ${brokerType}`);
    } catch (error) {
      logger.error('Failed to initialize event broker:', error);
      throw error;
    }
  }

  private async initializeKafka(): Promise<void> {
    const kafkaConfig = {
      clientId: 'thinkrank-realtime-service',
      brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
      ssl: process.env.KAFKA_SSL === 'true',
      sasl: process.env.KAFKA_USERNAME ? {
        mechanism: 'plain' as const,
        username: process.env.KAFKA_USERNAME,
        password: process.env.KAFKA_PASSWORD || ''
      } : undefined
    };

    this.kafka = new Kafka(kafkaConfig);
    this.producer = this.kafka.producer();
    this.consumer = this.kafka.consumer({ 
      groupId: 'realtime-service-group',
      sessionTimeout: 30000,
      heartbeatInterval: 3000
    });

    await this.producer.connect();
    await this.consumer.connect();

    // Setup consumer message handler
    await this.consumer.run({
      eachMessage: this.handleKafkaMessage.bind(this)
    });

    logger.info('Kafka producer and consumer initialized');
  }

  private async initializeRabbitMQ(): Promise<void> {
    const rabbitUrl = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
    
    this.rabbitConnection = await connect(rabbitUrl);
    this.rabbitChannel = await this.rabbitConnection.createChannel();

    // Setup exchanges and queues
    await this.setupRabbitMQTopology();

    // Setup consumer
    await this.rabbitChannel.consume('realtime-events', this.handleRabbitMessage.bind(this));

    logger.info('RabbitMQ connection and channel initialized');
  }

  private async setupRabbitMQTopology(): Promise<void> {
    if (!this.rabbitChannel) return;

    // Domain event exchange
    await this.rabbitChannel.assertExchange('domain.events', 'topic', { durable: true });
    
    // Game events
    await this.rabbitChannel.assertExchange('game.events', 'topic', { durable: true });
    
    // User events
    await this.rabbitChannel.assertExchange('user.events', 'topic', { durable: true });
    
    // System events
    await this.rabbitChannel.assertExchange('system.events', 'topic', { durable: true });

    // Queues
    await this.rabbitChannel.assertQueue('realtime-events', { durable: true });
    await this.rabbitChannel.assertQueue('game-state-events', { durable: true });
    await this.rabbitChannel.assertQueue('user-activity-events', { durable: true });

    // Bindings
    await this.rabbitChannel.bindQueue('realtime-events', 'domain.events', '*');
    await this.rabbitChannel.bindQueue('game-state-events', 'game.events', '*');
    await this.rabbitChannel.bindQueue('user-activity-events', 'user.events', '*');
  }

  private async handleKafkaMessage(payload: EachMessagePayload): Promise<void> {
    try {
      const event: DomainEvent = JSON.parse(payload.message.value?.toString() || '{}');
      await this.processEvent(event);
    } catch (error) {
      logger.error('Error processing Kafka message:', error);
    }
  }

  private async handleRabbitMessage(msg: any): Promise<void> {
    if (!msg) return;

    try {
      const event: DomainEvent = JSON.parse(msg.content.toString());
      await this.processEvent(event);
      this.rabbitChannel?.ack(msg);
    } catch (error) {
      logger.error('Error processing RabbitMQ message:', error);
      this.rabbitChannel?.nack(msg, false, false);
    }
  }

  private async processEvent(event: DomainEvent): Promise<void> {
    try {
      // Store event in event store
      await this.eventStore.saveEvent(event);

      // Execute registered handlers
      const handlers = this.eventHandlers.get(event.type) || [];
      
      await Promise.all(
        handlers.map(async (handlerInfo) => {
          try {
            await handlerInfo.handler(event);
          } catch (error) {
            logger.error(`Error in event handler for ${event.type}:`, error);
          }
        })
      );

      // Emit for local listeners
      this.emit(event.type, event);

    } catch (error) {
      logger.error('Error processing event:', error);
    }
  }

  // Public API methods
  async publishEvent(eventType: string, data: any, metadata: Partial<DomainEvent['metadata']> = {}): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Event broker not initialized');
    }

    const event: DomainEvent = {
      id: uuidv4(),
      type: eventType,
      aggregateId: data.aggregateId || uuidv4(),
      aggregateType: data.aggregateType || 'unknown',
      data,
      metadata: {
        timestamp: new Date().toISOString(),
        version: 1,
        correlationId: uuidv4(),
        ...metadata
      }
    };

    try {
      if (this.producer) {
        // Kafka
        await this.producer.send({
          topic: this.getTopicForEventType(eventType),
          messages: [{
            key: event.aggregateId,
            value: JSON.stringify(event),
            timestamp: new Date(event.metadata.timestamp).getTime().toString()
          }]
        });
      } else if (this.rabbitChannel) {
        // RabbitMQ
        const exchange = this.getExchangeForEventType(eventType);
        const routingKey = eventType;
        
        this.rabbitChannel.publish(
          exchange,
          routingKey,
          Buffer.from(JSON.stringify(event)),
          { 
            persistent: true,
            timestamp: new Date(event.metadata.timestamp).getTime()
          }
        );
      }

      logger.debug(`Published event: ${eventType}`, { eventId: event.id });

    } catch (error) {
      logger.error(`Failed to publish event ${eventType}:`, error);
      throw error;
    }
  }

  async subscribe(eventType: string, handler: (event: DomainEvent) => Promise<void> | void): Promise<void> {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }

    this.eventHandlers.get(eventType)!.push({ eventType, handler });

    // Subscribe to topic/queue if using message broker
    if (this.consumer) {
      const topic = this.getTopicForEventType(eventType);
      await this.consumer.subscribe({ topic });
    }

    logger.info(`Subscribed to event type: ${eventType}`);
  }

  async publishDomainEvent(
    aggregateType: string,
    aggregateId: string,
    eventType: string,
    data: any,
    metadata: Partial<DomainEvent['metadata']> = {}
  ): Promise<void> {
    await this.publishEvent(eventType, {
      aggregateType,
      aggregateId,
      ...data
    }, metadata);
  }

  private getTopicForEventType(eventType: string): string {
    const [domain] = eventType.split('.');
    return `${domain}-events`;
  }

  private getExchangeForEventType(eventType: string): string {
    const [domain] = eventType.split('.');
    return `${domain}.events`;
  }

  // Game-specific events
  async publishGameEvent(gameId: string, eventType: string, data: any, userId?: string): Promise<void> {
    await this.publishDomainEvent('game', gameId, `game.${eventType}`, data, { userId });
  }

  async publishUserEvent(userId: string, eventType: string, data: any): Promise<void> {
    await this.publishDomainEvent('user', userId, `user.${eventType}`, data, { userId });
  }

  async publishSystemEvent(eventType: string, data: any): Promise<void> {
    await this.publishDomainEvent('system', 'system', `system.${eventType}`, data);
  }

  // Event replay functionality
  async replayEvents(aggregateId: string, fromVersion: number = 0): Promise<DomainEvent[]> {
    return await this.eventStore.getEvents(aggregateId, fromVersion);
  }

  async replayEventsFromTimestamp(aggregateId: string, fromTimestamp: Date): Promise<DomainEvent[]> {
    return await this.eventStore.getEventsFromTimestamp(aggregateId, fromTimestamp);
  }

  // Snapshot support for event sourcing
  async createSnapshot(aggregateId: string, version: number, state: any): Promise<void> {
    await this.eventStore.saveSnapshot(aggregateId, version, state);
  }

  async getSnapshot(aggregateId: string): Promise<{ version: number; state: any } | null> {
    return await this.eventStore.getSnapshot(aggregateId);
  }

  // Health check
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      const checks = await Promise.allSettled([
        this.producer?.send({
          topic: 'health-check',
          messages: [{ value: JSON.stringify({ test: true, timestamp: Date.now() }) }]
        }),
        this.rabbitChannel?.assertQueue('health-check-temp', { durable: false, autoDelete: true })
      ]);

      const failures = checks.filter(result => result.status === 'rejected');
      
      return {
        status: failures.length === 0 ? 'healthy' : 'unhealthy',
        details: {
          kafka: this.producer ? 'connected' : 'not configured',
          rabbitmq: this.rabbitChannel ? 'connected' : 'not configured',
          failures: failures.length
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: error.message }
      };
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.producer) {
        await this.producer.disconnect();
      }
      
      if (this.consumer) {
        await this.consumer.disconnect();
      }
      
      if (this.rabbitConnection) {
        await this.rabbitConnection.close();
      }

      logger.info('Event broker disconnected');
    } catch (error) {
      logger.error('Error disconnecting event broker:', error);
    }
  }
}

export class EventStore {
  constructor(private redisManager: RedisManager) {}

  async initialize(): Promise<void> {
    // Initialize event store schemas if needed
    logger.info('Event store initialized');
  }

  async saveEvent(event: DomainEvent): Promise<void> {
    const eventKey = `events:${event.aggregateId}`;
    const streamKey = `stream:${event.aggregateType}`;
    const versionKey = `version:${event.aggregateId}`;

    // Use Redis pipeline for atomicity
    const pipeline = this.redisManager.getMainClient().pipeline();
    
    // Store event in aggregate stream
    pipeline.zadd(eventKey, event.metadata.version, JSON.stringify(event));
    
    // Add to global event stream
    pipeline.xadd(streamKey, '*', 'event', JSON.stringify(event));
    
    // Update version
    pipeline.set(versionKey, event.metadata.version);
    
    // Set TTL for event cleanup (optional)
    const ttl = parseInt(process.env.EVENT_TTL_DAYS || '90') * 24 * 60 * 60;
    pipeline.expire(eventKey, ttl);

    await pipeline.exec();
  }

  async getEvents(aggregateId: string, fromVersion: number = 0): Promise<DomainEvent[]> {
    const eventKey = `events:${aggregateId}`;
    const events = await this.redisManager.zrangebyscore(eventKey, fromVersion, '+inf');
    
    return events.map(eventData => JSON.parse(eventData));
  }

  async getEventsFromTimestamp(aggregateId: string, fromTimestamp: Date): Promise<DomainEvent[]> {
    const eventKey = `events:${aggregateId}`;
    const allEvents = await this.redisManager.zrange(eventKey, 0, -1);
    
    return allEvents
      .map(eventData => JSON.parse(eventData))
      .filter(event => new Date(event.metadata.timestamp) >= fromTimestamp);
  }

  async getEventCount(aggregateId: string): Promise<number> {
    const eventKey = `events:${aggregateId}`;
    return await this.redisManager.getMainClient().zcard(eventKey);
  }

  async getVersion(aggregateId: string): Promise<number> {
    const versionKey = `version:${aggregateId}`;
    const version = await this.redisManager.get<number>(versionKey);
    return version || 0;
  }

  async saveSnapshot(aggregateId: string, version: number, state: any): Promise<void> {
    const snapshotKey = `snapshot:${aggregateId}`;
    await this.redisManager.set(snapshotKey, { version, state, timestamp: new Date().toISOString() });
  }

  async getSnapshot(aggregateId: string): Promise<{ version: number; state: any } | null> {
    const snapshotKey = `snapshot:${aggregateId}`;
    return await this.redisManager.get(snapshotKey);
  }

  async deleteSnapshot(aggregateId: string): Promise<void> {
    const snapshotKey = `snapshot:${aggregateId}`;
    await this.redisManager.del(snapshotKey);
  }

  // Stream processing for real-time event handling
  async createEventStream(streamName: string): Promise<void> {
    const streamKey = `stream:${streamName}`;
    try {
      await this.redisManager.getMainClient().xgroup('CREATE', streamKey, 'realtime-processors', '$', 'MKSTREAM');
    } catch (error) {
      // Group may already exist
      if (!error.message.includes('BUSYGROUP')) {
        throw error;
      }
    }
  }

  async readEventStream(streamName: string, count: number = 10): Promise<any[]> {
    const streamKey = `stream:${streamName}`;
    const results = await this.redisManager.getMainClient().xreadgroup(
      'GROUP', 'realtime-processors', 'consumer-1',
      'COUNT', count,
      'STREAMS', streamKey, '>'
    );

    if (!results || results.length === 0) {
      return [];
    }

    return results[0][1].map((entry: any) => ({
      id: entry[0],
      fields: entry[1]
    }));
  }
}