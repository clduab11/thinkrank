import { EventEmitter } from 'eventemitter3';
import { DomainEvent, EventBus } from '../types/domain.types';
import { Logger } from 'pino';
import * as amqp from 'amqplib';

export class InMemoryEventBus implements EventBus {
  private eventEmitter: EventEmitter;
  private logger: Logger;

  constructor(logger: Logger) {
    this.eventEmitter = new EventEmitter();
    this.logger = logger;
  }

  async publish(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      this.logger.info({ event }, 'Publishing domain event');
      this.eventEmitter.emit(event.eventType, event);
    }
  }

  subscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>): void {
    this.eventEmitter.on(eventType, async (event: DomainEvent) => {
      try {
        await handler(event);
        this.logger.info({ eventType, eventId: event.id }, 'Event handler completed successfully');
      } catch (error) {
        this.logger.error({ error, eventType, eventId: event.id }, 'Event handler failed');
        // Could implement retry logic here
      }
    });
  }
}

export class RabbitMQEventBus implements EventBus {
  private connection?: amqp.Connection;
  private channel?: amqp.Channel;
  private logger: Logger;
  private readonly exchangeName = 'ai-domain-events';

  constructor(logger: Logger, private connectionUrl: string) {
    this.logger = logger;
  }

  async initialize(): Promise<void> {
    try {
      this.connection = await amqp.connect(this.connectionUrl);
      this.channel = await this.connection.createChannel();
      
      // Declare exchange for domain events
      await this.channel.assertExchange(this.exchangeName, 'topic', { durable: true });
      
      this.logger.info('RabbitMQ EventBus initialized successfully');
    } catch (error) {
      this.logger.error({ error }, 'Failed to initialize RabbitMQ EventBus');
      throw error;
    }
  }

  async publish(events: DomainEvent[]): Promise<void> {
    if (!this.channel) {
      throw new Error('EventBus not initialized');
    }

    for (const event of events) {
      const routingKey = `${event.aggregateType}.${event.eventType}`;
      const message = Buffer.from(JSON.stringify(event));
      
      try {
        await this.channel.publish(this.exchangeName, routingKey, message, {
          persistent: true,
          timestamp: Date.now(),
          messageId: event.id
        });
        
        this.logger.info({ eventId: event.id, routingKey }, 'Published domain event to RabbitMQ');
      } catch (error) {
        this.logger.error({ error, eventId: event.id }, 'Failed to publish event to RabbitMQ');
        throw error;
      }
    }
  }

  subscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>): void {
    if (!this.channel) {
      throw new Error('EventBus not initialized');
    }

    const queueName = `ai-domain-${eventType}-handler`;
    const routingKey = `*.${eventType}`;

    this.channel.assertQueue(queueName, { durable: true })
      .then(() => this.channel!.bindQueue(queueName, this.exchangeName, routingKey))
      .then(() => {
        return this.channel!.consume(queueName, async (msg) => {
          if (msg) {
            try {
              const event: DomainEvent = JSON.parse(msg.content.toString());
              await handler(event);
              this.channel!.ack(msg);
              this.logger.info({ eventId: event.id }, 'Event handler completed successfully');
            } catch (error) {
              this.logger.error({ error }, 'Event handler failed');
              this.channel!.nack(msg, false, false); // Dead letter queue
            }
          }
        });
      })
      .catch(error => {
        this.logger.error({ error, eventType }, 'Failed to setup event subscription');
      });
  }

  async close(): Promise<void> {
    try {
      await this.channel?.close();
      await this.connection?.close();
      this.logger.info('RabbitMQ EventBus closed successfully');
    } catch (error) {
      this.logger.error({ error }, 'Error closing RabbitMQ EventBus');
    }
  }
}

// Event Bus Factory
export class EventBusFactory {
  static create(logger: Logger, config?: { type: 'memory' | 'rabbitmq'; connectionUrl?: string }): EventBus {
    if (!config || config.type === 'memory') {
      return new InMemoryEventBus(logger);
    }
    
    if (config.type === 'rabbitmq' && config.connectionUrl) {
      return new RabbitMQEventBus(logger, config.connectionUrl);
    }
    
    throw new Error('Invalid EventBus configuration');
  }
}