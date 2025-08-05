import { Pool, PoolClient } from 'pg';
import { Logger } from 'pino';
import { BaseRepository } from './base-repository';
import { ContentGenerationAggregate } from '../domain/content-generation/content-aggregate';
import { EventStore } from '../types/domain.types';

export class ContentGenerationRepository extends BaseRepository<ContentGenerationAggregate> {
  constructor(pool: Pool, eventStore: EventStore, logger: Logger) {
    super(pool, eventStore, logger, 'content_generation_aggregates');
  }

  protected createFromSnapshot(snapshot: any): ContentGenerationAggregate {
    const aggregate = new ContentGenerationAggregate(snapshot.id);
    
    // Restore state from snapshot
    if (snapshot.requests) {
      const requests = JSON.parse(snapshot.requests);
      for (const [requestId, request] of Object.entries(requests)) {
        aggregate['requests'].set(requestId, request as any);
      }
    }

    if (snapshot.generated_content) {
      const content = JSON.parse(snapshot.generated_content);
      for (const [contentId, contentData] of Object.entries(content)) {
        aggregate['generatedContent'].set(contentId, contentData as any);
      }
    }

    aggregate.version = snapshot.version || 0;
    return aggregate;
  }

  protected async saveSnapshot(client: PoolClient, aggregate: ContentGenerationAggregate): Promise<void> {
    const requests = Object.fromEntries(aggregate['requests']);
    const generatedContent = Object.fromEntries(aggregate['generatedContent']);

    await client.query(`
      INSERT INTO ${this.tableName} (
        id, version, requests, generated_content, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        version = $2,
        requests = $3,
        generated_content = $4,
        updated_at = NOW()
    `, [
      aggregate.id,
      aggregate.version,
      JSON.stringify(requests),
      JSON.stringify(generatedContent)
    ]);
  }

  // Additional query methods specific to content generation
  async findByUserId(userId: string): Promise<ContentGenerationAggregate[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT * FROM ${this.tableName} 
        WHERE requests::text LIKE '%"userId":"${userId}"%'
        ORDER BY updated_at DESC
      `);

      const aggregates: ContentGenerationAggregate[] = [];
      for (const row of result.rows) {
        const aggregate = this.createFromSnapshot(row);
        const events = await this.eventStore.getEvents(aggregate.id, aggregate.version);
        if (events.length > 0) {
          aggregate.loadFromHistory(events);
        }
        aggregates.push(aggregate);
      }

      return aggregates;
    } finally {
      client.release();
    }
  }

  async findByContentType(type: 'text' | 'image'): Promise<ContentGenerationAggregate[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT * FROM ${this.tableName} 
        WHERE requests::text LIKE '%"type":"${type}"%'
        ORDER BY updated_at DESC
      `);

      const aggregates: ContentGenerationAggregate[] = [];
      for (const row of result.rows) {
        const aggregate = this.createFromSnapshot(row);
        const events = await this.eventStore.getEvents(aggregate.id, aggregate.version);
        if (events.length > 0) {
          aggregate.loadFromHistory(events);
        }
        aggregates.push(aggregate);
      }

      return aggregates;
    } finally {
      client.release();
    }
  }

  async getContentGenerationStats(): Promise<{
    totalRequests: number;
    totalGenerated: number;
    successRate: number;
    byType: Record<string, number>;
  }> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          COUNT(*) as total_aggregates,
          SUM(jsonb_array_length(COALESCE(requests::jsonb, '{}')::jsonb)) as total_requests,
          SUM(jsonb_array_length(COALESCE(generated_content::jsonb, '{}')::jsonb)) as total_generated
        FROM ${this.tableName}
      `);

      const stats = result.rows[0];
      return {
        totalRequests: parseInt(stats.total_requests || '0'),
        totalGenerated: parseInt(stats.total_generated || '0'),
        successRate: stats.total_requests > 0 
          ? parseFloat((stats.total_generated / stats.total_requests * 100).toFixed(2))
          : 0,
        byType: {} // Could be implemented with more complex queries
      };
    } finally {
      client.release();
    }
  }
}