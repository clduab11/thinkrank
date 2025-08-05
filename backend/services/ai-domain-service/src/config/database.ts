import { Pool, PoolConfig } from 'pg';
import { Logger } from 'pino';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: {
    rejectUnauthorized: boolean;
    ca?: string;
  };
  pool: {
    min: number;
    max: number;
    idleTimeoutMillis: number;
    connectionTimeoutMillis: number;
  };
  readReplicas?: Array<{
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
  }>;
}

export class DatabaseManager {
  private primaryPool: Pool;
  private readReplicaPools: Pool[] = [];
  private logger: Logger;

  constructor(config: DatabaseConfig, logger: Logger) {
    this.logger = logger;
    
    // Primary database connection pool
    const primaryConfig: PoolConfig = {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      ssl: config.ssl,
      min: config.pool.min,
      max: config.pool.max,
      idleTimeoutMillis: config.pool.idleTimeoutMillis,
      connectionTimeoutMillis: config.pool.connectionTimeoutMillis,
      // Connection validation
      query_timeout: 30000,
      statement_timeout: 30000,
      // Additional pg pool settings
      allowExitOnIdle: false
    };

    this.primaryPool = new Pool(primaryConfig);
    this.setupPoolEventHandlers(this.primaryPool, 'primary');

    // Read replica pools
    if (config.readReplicas) {
      config.readReplicas.forEach((replica, index) => {
        const replicaConfig: PoolConfig = {
          ...primaryConfig,
          host: replica.host,
          port: replica.port,
          database: replica.database,
          user: replica.username,
          password: replica.password
        };
        
        const replicaPool = new Pool(replicaConfig);
        this.setupPoolEventHandlers(replicaPool, `replica-${index}`);
        this.readReplicaPools.push(replicaPool);
      });
    }
  }

  private setupPoolEventHandlers(pool: Pool, poolName: string): void {
    pool.on('connect', (client) => {
      this.logger.info({ poolName }, 'New database client connected');
    });

    pool.on('acquire', (client) => {
      this.logger.debug({ poolName }, 'Client acquired from pool');
    });

    pool.on('remove', (client) => {
      this.logger.info({ poolName }, 'Client removed from pool');
    });

    pool.on('error', (err, client) => {
      this.logger.error({ error: err, poolName }, 'Database pool error');
    });
  }

  // Primary pool for writes and consistent reads
  getPrimaryPool(): Pool {
    return this.primaryPool;
  }

  // Read replica pool for analytics queries (round-robin)
  getReadPool(): Pool {
    if (this.readReplicaPools.length === 0) {
      return this.primaryPool;
    }
    
    // Simple round-robin load balancing
    const index = Math.floor(Math.random() * this.readReplicaPools.length);
    return this.readReplicaPools[index];
  }

  // Health check for all pools
  async healthCheck(): Promise<{
    primary: boolean;
    readReplicas: boolean[];
    totalConnections: number;
    idleConnections: number;
  }> {
    const results = {
      primary: false,
      readReplicas: [] as boolean[],
      totalConnections: 0,
      idleConnections: 0
    };

    try {
      // Check primary pool
      const primaryClient = await this.primaryPool.connect();
      await primaryClient.query('SELECT 1');
      primaryClient.release();
      results.primary = true;
      results.totalConnections += this.primaryPool.totalCount;
      results.idleConnections += this.primaryPool.idleCount;
    } catch (error) {
      this.logger.error({ error }, 'Primary database health check failed');
    }

    // Check read replica pools
    for (const replicaPool of this.readReplicaPools) {
      try {
        const replicaClient = await replicaPool.connect();
        await replicaClient.query('SELECT 1');
        replicaClient.release();
        results.readReplicas.push(true);
        results.totalConnections += replicaPool.totalCount;
        results.idleConnections += replicaPool.idleCount;
      } catch (error) {
        this.logger.error({ error }, 'Read replica health check failed');
        results.readReplicas.push(false);
      }
    }

    return results;
  }

  // Close all connections
  async close(): Promise<void> {
    try {
      await this.primaryPool.end();
      this.logger.info('Primary database pool closed');

      await Promise.all(this.readReplicaPools.map(async (pool, index) => {
        await pool.end();
        this.logger.info({ replicaIndex: index }, 'Read replica pool closed');
      }));

      this.logger.info('All database pools closed successfully');
    } catch (error) {
      this.logger.error({ error }, 'Error closing database pools');
      throw error;
    }
  }

  // Get connection statistics
  getConnectionStats(): {
    primary: { total: number; idle: number; waiting: number };
    readReplicas: Array<{ total: number; idle: number; waiting: number }>;
  } {
    return {
      primary: {
        total: this.primaryPool.totalCount,
        idle: this.primaryPool.idleCount,
        waiting: this.primaryPool.waitingCount
      },
      readReplicas: this.readReplicaPools.map(pool => ({
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount
      }))
    };
  }
}

// Database configuration factory
export function createDatabaseConfig(): DatabaseConfig {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'thinkrank',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true' ? {
      rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
      ca: process.env.DB_SSL_CA
    } : undefined,
    pool: {
      min: parseInt(process.env.DB_POOL_MIN || '2'),
      max: parseInt(process.env.DB_POOL_MAX || '20'),
      idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000'),
      connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT || '2000')
    },
    readReplicas: process.env.DB_READ_REPLICAS ? 
      JSON.parse(process.env.DB_READ_REPLICAS) : undefined
  };
}

// Circuit breaker for database operations
export class DatabaseCircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private readonly failureThreshold = 5,
    private readonly recoveryTimeout = 30000,
    private readonly logger: Logger
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime < this.recoveryTimeout) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'half-open';
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
    this.logger.debug('Circuit breaker: Operation succeeded, state is CLOSED');
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
      this.logger.warn({ failures: this.failures }, 'Circuit breaker opened due to failures');
    }
  }

  getState(): { state: string; failures: number; lastFailureTime: number } {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    };
  }
}