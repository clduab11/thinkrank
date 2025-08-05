import { DomainEvent, AggregateRoot } from '../types/domain.types';
import { v4 as uuidv4 } from 'uuid';

export abstract class BaseAggregate implements AggregateRoot {
  public readonly id: string;
  public version: number = 0;
  public uncommittedEvents: DomainEvent[] = [];

  constructor(id?: string) {
    this.id = id || uuidv4();
  }

  protected applyEvent(event: DomainEvent): void {
    this.uncommittedEvents.push(event);
    this.version++;
    this.when(event);
  }

  protected createEvent(eventType: string, eventData: any, metadata?: Record<string, any>): DomainEvent {
    return {
      id: uuidv4(),
      aggregateId: this.id,
      aggregateType: this.constructor.name,
      eventType,
      eventData,
      version: this.version + 1,
      timestamp: new Date(),
      metadata
    };
  }

  public getUncommittedEvents(): DomainEvent[] {
    return [...this.uncommittedEvents];
  }

  public markEventsAsCommitted(): void {
    this.uncommittedEvents = [];
  }

  public loadFromHistory(events: DomainEvent[]): void {
    events.forEach(event => {
      this.when(event);
      this.version = event.version;
    });
  }

  protected abstract when(event: DomainEvent): void;
}