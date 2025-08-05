import { Pool, PoolClient } from 'pg';
import { Logger } from 'pino';
import { BaseRepository } from './base-repository';
import { ResearchProblemAggregate } from '../domain/research-problems/research-problem-aggregate';
import { EventStore, ResearchProblems } from '../types/domain.types';

export class ResearchProblemRepository extends BaseRepository<ResearchProblemAggregate> {
  constructor(pool: Pool, eventStore: EventStore, logger: Logger) {
    super(pool, eventStore, logger, 'research_problem_aggregates');
  }

  protected createFromSnapshot(snapshot: any): ResearchProblemAggregate {
    const aggregate = new ResearchProblemAggregate(snapshot.id);
    
    // Restore state from snapshot
    if (snapshot.problems) {
      const problems = JSON.parse(snapshot.problems);
      for (const [problemId, problem] of Object.entries(problems)) {
        aggregate['problems'].set(problemId, problem as any);
      }
    }

    if (snapshot.game_transformations) {
      const transformations = JSON.parse(snapshot.game_transformations);
      for (const [gameId, transformation] of Object.entries(transformations)) {
        aggregate['gameTransformations'].set(gameId, transformation as any);
      }
    }

    aggregate.version = snapshot.version || 0;
    return aggregate;
  }

  protected async saveSnapshot(client: PoolClient, aggregate: ResearchProblemAggregate): Promise<void> {
    const problems = Object.fromEntries(aggregate['problems']);
    const gameTransformations = Object.fromEntries(aggregate['gameTransformations']);

    await client.query(`
      INSERT INTO ${this.tableName} (
        id, version, problems, game_transformations, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        version = $2,
        problems = $3,
        game_transformations = $4,
        updated_at = NOW()
    `, [
      aggregate.id,
      aggregate.version,
      JSON.stringify(problems),
      JSON.stringify(gameTransformations)
    ]);
  }

  // Specialized query methods for research problems
  async findByProblemType(problemType: ResearchProblems.ProblemType): Promise<ResearchProblemAggregate[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT * FROM ${this.tableName} 
        WHERE problems::text LIKE '%"problemType":"${problemType}"%'
        ORDER BY updated_at DESC
      `);

      const aggregates: ResearchProblemAggregate[] = [];
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

  async findByDifficultyRange(minLevel: number, maxLevel: number): Promise<ResearchProblemAggregate[]> {
    const client = await this.pool.connect();
    try {
      // This would need a more sophisticated JSON query for production
      const result = await client.query(`
        SELECT * FROM ${this.tableName} 
        WHERE problems::text ~ '"difficultyLevel":[${minLevel}-${maxLevel}]'
        ORDER BY updated_at DESC
      `);

      const aggregates: ResearchProblemAggregate[] = [];
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

  async findByInstitution(institutionId: string): Promise<ResearchProblemAggregate[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT * FROM ${this.tableName} 
        WHERE problems::text LIKE '%"institutionId":"${institutionId}"%'
        ORDER BY updated_at DESC
      `);

      const aggregates: ResearchProblemAggregate[] = [];
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

  async getResearchProblemStats(): Promise<{
    totalProblems: number;
    activeProblems: number;
    totalContributions: number;
    byType: Record<ResearchProblems.ProblemType, number>;
    byDifficulty: Record<string, number>;
  }> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          COUNT(*) as total_aggregates,
          SUM(jsonb_array_length(COALESCE(problems::jsonb, '{}')::jsonb)) as total_problems
        FROM ${this.tableName}
      `);

      const stats = result.rows[0];
      return {
        totalProblems: parseInt(stats.total_problems || '0'),
        activeProblems: 0, // Would need more complex query
        totalContributions: 0, // Would need aggregation
        byType: {} as Record<ResearchProblems.ProblemType, number>,
        byDifficulty: {}
      };
    } finally {
      client.release();
    }
  }

  async findGameTransformations(researchProblemId: string): Promise<any[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT game_transformations FROM ${this.tableName} 
        WHERE problems::text LIKE '%"${researchProblemId}"%'
      `);

      const transformations: any[] = [];
      for (const row of result.rows) {
        if (row.game_transformations) {
          const gameTransformations = JSON.parse(row.game_transformations);
          transformations.push(...Object.values(gameTransformations));
        }
      }

      return transformations;
    } finally {
      client.release();
    }
  }
}