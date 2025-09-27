// Database configuration and connection utilities
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

// Database configuration interface
export interface DatabaseConfig {
  supabase_url: string;
  supabase_anon_key: string;
  supabase_service_role_key: string;
  connection_pool_min: number;
  connection_pool_max: number;
  query_timeout_ms: number;
  ssl_mode: 'require' | 'prefer' | 'disable';
}

// Environment-based configuration
export const getDatabaseConfig = (): DatabaseConfig => {
  const config: DatabaseConfig = {
    supabase_url: process.env['SUPABASE_URL'] || '',
    supabase_anon_key: process.env['SUPABASE_ANON_KEY'] || '',
    supabase_service_role_key: process.env['SUPABASE_SERVICE_ROLE_KEY'] || '',
    connection_pool_min: parseInt(process.env['DB_POOL_MIN'] || '2'),
    connection_pool_max: parseInt(process.env['DB_POOL_MAX'] || '10'),
    query_timeout_ms: parseInt(process.env['DB_QUERY_TIMEOUT_MS'] || '30000'),
    ssl_mode: (process.env['DB_SSL_MODE'] as 'require' | 'prefer' | 'disable') || 'require'
  };

  // Validate required configuration
  if (!config.supabase_url || !config.supabase_anon_key || !config.supabase_service_role_key) {
    throw new Error('Missing required Supabase configuration. Please check environment variables.');
  }

  return config;
};

// Supabase client factory
export class SupabaseClientFactory {
  private static instance: SupabaseClientFactory;
  private clientCache: Map<string, SupabaseClient> = new Map();
  private config: DatabaseConfig;

  private constructor() {
    this.config = getDatabaseConfig();
  }

  public static getInstance(): SupabaseClientFactory {
    if (!SupabaseClientFactory.instance) {
      SupabaseClientFactory.instance = new SupabaseClientFactory();
    }
    return SupabaseClientFactory.instance;
  }

  // Get client for regular operations (with RLS)
  public getClient(): SupabaseClient<Database> {
    const key = 'anon';
    if (!this.clientCache.has(key)) {
      const client = createClient<Database>(
        this.config.supabase_url,
        this.config.supabase_anon_key,
        {
          auth: {
            autoRefreshToken: true,
            persistSession: false
          },
          db: {
            schema: 'public'
          }
        }
      );
      this.clientCache.set(key, client);
    }
    return this.clientCache.get(key)!;
  }

  // Get service role client for admin operations (bypasses RLS)
  public getServiceRoleClient(): SupabaseClient<Database> {
    const key = 'service_role';
    if (!this.clientCache.has(key)) {
      const client = createClient<Database>(
        this.config.supabase_url,
        this.config.supabase_service_role_key,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          },
          db: {
            schema: 'public'
          }
        }
      );
      this.clientCache.set(key, client);
    }
    return this.clientCache.get(key)!;
  }

  // Get authenticated client for specific user
  public getAuthenticatedClient(accessToken: string): SupabaseClient<Database> {
    const client = this.getClient();
    client.auth.session = () => ({
      access_token: accessToken,
      refresh_token: '',
      expires_in: 3600,
      token_type: 'bearer',
      user: null as any
    });
    return client;
  }

  // Health check for database connectivity
  public async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    try {
      const client = this.getServiceRoleClient();
      const { data, error } = await client
        .from('users')
        .select('id')
        .limit(1);

      if (error) {
        return { healthy: false, error: error.message };
      }

      return { healthy: true };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown database error'
      };
    }
  }

  // Close all connections
  public async close(): Promise<void> {
    // Supabase client doesn't require explicit connection closing
    this.clientCache.clear();
  }
}

// Database connection helper
export const getDatabase = () => SupabaseClientFactory.getInstance();

// Query builder utilities
export class QueryBuilder {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  // Generic paginated query
  async paginate<T>(
    table: string,
    options: {
      select?: string;
      filters?: Record<string, any>;
      order?: { column: string; ascending?: boolean }[];
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ data: T[]; count: number; error?: any }> {
    let query = this.supabase
      .from(table)
      .select(options.select || '*', { count: 'exact' });

    // Apply filters
    if (options.filters) {
      Object.entries(options.filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            query = query.in(key, value);
          } else {
            query = query.eq(key, value);
          }
        }
      });
    }

    // Apply ordering
    if (options.order) {
      options.order.forEach(({ column, ascending = true }) => {
        query = query.order(column, { ascending });
      });
    }

    // Apply pagination
    if (options.limit) {
      query = query.limit(options.limit);
    }
    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data, error, count } = await query;

    return {
      data: data as T[],
      count: count || 0,
      error
    };
  }

  // Search with text matching
  async search<T>(
    table: string,
    searchColumn: string,
    searchTerm: string,
    options: {
      select?: string;
      additionalFilters?: Record<string, any>;
      limit?: number;
    } = {}
  ): Promise<{ data: T[]; error?: any }> {
    let query = this.supabase
      .from(table)
      .select(options.select || '*')
      .textSearch(searchColumn, searchTerm);

    // Apply additional filters
    if (options.additionalFilters) {
      Object.entries(options.additionalFilters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    return { data: data as T[], error };
  }
}

// Database transaction helper
export class DatabaseTransaction {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  // Execute multiple operations in sequence with error handling
  async execute<T>(operations: Array<() => Promise<any>>): Promise<T[]> {
    const results: T[] = [];

    for (const operation of operations) {
      try {
        const result = await operation();
        if (result.error) {
          throw new Error(`Transaction failed: ${result.error.message}`);
        }
        results.push(result.data);
      } catch (error) {
        // In a real implementation, you'd want to rollback previous operations
        // Supabase doesn't directly support transactions, so you'd need to implement
        // compensation logic or use stored procedures for complex transactions
        throw error;
      }
    }

    return results;
  }
}
