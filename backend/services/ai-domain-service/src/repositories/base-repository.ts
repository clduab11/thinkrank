import { Pool, PoolClient } from 'pg';
import { Logger } from 'pino';
import { Repository, AggregateRoot, EventStore, DomainEvent } from '../types/domain.types';

export abstract class BaseRepository<T extends AggregateRoot> implements Repository<T> {
  constructor(
    protected pool: Pool,
    protected eventStore: EventStore,
    protected logger: Logger,
    protected tableName: string
  ) {}

  async getById(id: string): Promise<T | null> {
    const client = await this.pool.connect();
    try {
      // Get aggregate snapshot from database
      const snapshotResult = await client.query(
        `SELECT * FROM ${this.tableName} WHERE id = $1`,
        [id]
      );

      if (snapshotResult.rows.length === 0) {
        return null;
      }

      // Create aggregate from snapshot
      const aggregate = this.createFromSnapshot(snapshotResult.rows[0]);

      // Load events since snapshot
      const events = await this.eventStore.getEvents(id, aggregate.version);
      if (events.length > 0) {
        aggregate.loadFromHistory(events);
      }

      return aggregate;
    } catch (error) {
      this.logger.error({ error, aggregateId: id }, 'Failed to get aggregate by ID');
      throw error;
    } finally {
      client.release();
    }
  }

  async save(aggregate: T): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Save events first
      const events = aggregate.getUncommittedEvents();
      if (events.length > 0) {
        await this.eventStore.saveEvents(aggregate.id, events, aggregate.version - events.length);
      }

      // Update or insert aggregate snapshot
      await this.saveSnapshot(client, aggregate);

      await client.query('COMMIT');
      
      // Mark events as committed after successful save
      aggregate.markEventsAsCommitted();

      this.logger.info({ 
        aggregateId: aggregate.id, 
        version: aggregate.version,
        eventsCount: events.length 
      }, 'Successfully saved aggregate');

    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error({ error, aggregateId: aggregate.id }, 'Failed to save aggregate');
      throw error;
    } finally {
      client.release();
    }
  }

  async delete(id: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Soft delete by setting active = false
      await client.query(
        `UPDATE ${this.tableName} SET active = false, updated_at = NOW() WHERE id = $1`,
        [id]
      );

      // Create deletion event
      const deletionEvent: DomainEvent = {
        id: `del_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        aggregateId: id,
        aggregateType: this.tableName,
        eventType: 'AggregateDeleted',
        eventData: { deletedAt: new Date() },
        version: 0, // Will be set by event store
        timestamp: new Date()
      };

      await this.eventStore.saveEvents(id, [deletionEvent], -1);

      await client.query('COMMIT');
      
      this.logger.info({ aggregateId: id }, 'Successfully deleted aggregate');
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error({ error, aggregateId: id }, 'Failed to delete aggregate');
      throw error;
    } finally {
      client.release();
    }
  }

  protected abstract createFromSnapshot(snapshot: any): T;
  protected abstract saveSnapshot(client: PoolClient, aggregate: T): Promise<void>;
}

// PostgreSQL Event Store Implementation
export class PostgreSQLEventStore implements EventStore {
  constructor(
    private pool: Pool,
    private logger: Logger
  ) {}

  async saveEvents(aggregateId: string, events: DomainEvent[], expectedVersion: number): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Check version conflict
      const versionResult = await client.query(
        'SELECT MAX(version) as current_version FROM events WHERE aggregate_id = $1',
        [aggregateId]
      );

      const currentVersion = versionResult.rows[0]?.current_version || 0;
      if (currentVersion !== expectedVersion) {
        throw new Error(`Version conflict. Expected: ${expectedVersion}, Current: ${currentVersion}`);
      }

      // Insert events
      for (const event of events) {
        await client.query(`
          INSERT INTO events (
            id, aggregate_id, aggregate_type, event_type, event_data, 
            version, timestamp, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          event.id,
          event.aggregateId,
          event.aggregateType,
          event.eventType,
          JSON.stringify(event.eventData),
          event.version,
          event.timestamp,
          JSON.stringify(event.metadata || {})
        ]);
      }

      await client.query('COMMIT');
      
      this.logger.info({ 
        aggregateId, 
        eventsCount: events.length,
        fromVersion: expectedVersion + 1,
        toVersion: expectedVersion + events.length
      }, 'Successfully saved events');

    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error({ error, aggregateId }, 'Failed to save events');
      throw error;
    } finally {
      client.release();
    }
  }

  async getEvents(aggregateId: string, fromVersion?: number): Promise<DomainEvent[]> {
    const client = await this.pool.connect();
    try {
      const query = fromVersion 
        ? 'SELECT * FROM events WHERE aggregate_id = $1 AND version > $2 ORDER BY version ASC'
        : 'SELECT * FROM events WHERE aggregate_id = $1 ORDER BY version ASC';
      
      const params = fromVersion ? [aggregateId, fromVersion] : [aggregateId];
      const result = await client.query(query, params);

      return result.rows.map(row => ({
        id: row.id,
        aggregateId: row.aggregate_id,
        aggregateType: row.aggregate_type,
        eventType: row.event_type,
        eventData: JSON.parse(row.event_data),
        version: row.version,
        timestamp: new Date(row.timestamp),
        metadata: JSON.parse(row.metadata || '{}')
      }));

    } catch (error) {
      this.logger.error({ error, aggregateId }, 'Failed to get events');
      throw error;
    } finally {
      client.release();
    }
  }
}