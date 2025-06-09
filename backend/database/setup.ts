// Database setup and migration runner for ThinkRank
import { getDatabase, Logger } from '@thinkrank/shared';
import { readFileSync } from 'fs';
import { join } from 'path';

const logger = Logger.getInstance('database-setup');

interface MigrationFile {
  filename: string;
  version: string;
  sql: string;
}

class DatabaseSetup {
  private supabase = getDatabase().getServiceRoleClient();

  // Get all migration files
  private getMigrationFiles(): MigrationFile[] {
    const migrationsDir = join(__dirname, 'migrations');
    const migrationFiles: MigrationFile[] = [];

    try {
      // For this example, we'll manually list the migration files
      // In a real implementation, you'd read the directory
      const files = ['001_initial_schema.sql'];

      for (const filename of files) {
        const filePath = join(migrationsDir, filename);
        const sql = readFileSync(filePath, 'utf-8');
        const version = filename.split('_')[0];

        migrationFiles.push({
          filename,
          version,
          sql
        });
      }

      return migrationFiles.sort((a, b) => a.version.localeCompare(b.version));
    } catch (error) {
      logger.error('Failed to read migration files', {}, error as Error);
      throw error;
    }
  }

  // Check if migrations table exists
  private async createMigrationsTable(): Promise<void> {
    const createMigrationsTableSQL = `
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        version VARCHAR(50) UNIQUE NOT NULL,
        filename VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        checksum VARCHAR(255),
        execution_time_ms INTEGER
      );
    `;

    try {
      await this.supabase.rpc('exec_sql', { sql: createMigrationsTableSQL });
      logger.info('Migrations table created or already exists');
    } catch (error) {
      logger.error('Failed to create migrations table', {}, error as Error);
      throw error;
    }
  }

  // Get executed migrations
  private async getExecutedMigrations(): Promise<string[]> {
    try {
      const { data, error } = await this.supabase
        .from('_migrations')
        .select('version')
        .order('version');

      if (error) {
        throw error;
      }

      return data?.map(row => row.version) || [];
    } catch (error) {
      logger.error('Failed to get executed migrations', {}, error as Error);
      return [];
    }
  }

  // Execute a single migration
  private async executeMigration(migration: MigrationFile): Promise<void> {
    const startTime = Date.now();

    try {
      logger.info(`Executing migration: ${migration.filename}`);

      // Execute the migration SQL
      await this.supabase.rpc('exec_sql', { sql: migration.sql });

      const executionTime = Date.now() - startTime;

      // Record the migration
      const { error } = await this.supabase
        .from('_migrations')
        .insert({
          version: migration.version,
          filename: migration.filename,
          execution_time_ms: executionTime,
          checksum: this.generateChecksum(migration.sql)
        });

      if (error) {
        throw error;
      }

      logger.info(`Migration ${migration.filename} executed successfully`, {
        execution_time_ms: executionTime
      });
    } catch (error) {
      logger.error(`Migration ${migration.filename} failed`, {}, error as Error);
      throw error;
    }
  }

  // Generate checksum for migration SQL
  private generateChecksum(sql: string): string {
    // Simple checksum - in production you'd use a proper hash function
    return Buffer.from(sql).toString('base64').substring(0, 32);
  }

  // Run all pending migrations
  public async runMigrations(): Promise<void> {
    try {
      logger.info('Starting database migrations');

      // Ensure migrations table exists
      await this.createMigrationsTable();

      // Get migration files and executed migrations
      const migrationFiles = this.getMigrationFiles();
      const executedMigrations = await this.getExecutedMigrations();

      // Find pending migrations
      const pendingMigrations = migrationFiles.filter(
        migration => !executedMigrations.includes(migration.version)
      );

      if (pendingMigrations.length === 0) {
        logger.info('No pending migrations');
        return;
      }

      logger.info(`Found ${pendingMigrations.length} pending migrations`);

      // Execute pending migrations
      for (const migration of pendingMigrations) {
        await this.executeMigration(migration);
      }

      logger.info('All migrations completed successfully');
    } catch (error) {
      logger.error('Migration process failed', {}, error as Error);
      throw error;
    }
  }

  // Load seed data
  public async loadSeedData(): Promise<void> {
    try {
      logger.info('Loading seed data');

      const seedFile = join(__dirname, 'seeds', '001_development_data.sql');
      const seedSQL = readFileSync(seedFile, 'utf-8');

      await this.supabase.rpc('exec_sql', { sql: seedSQL });

      logger.info('Seed data loaded successfully');
    } catch (error) {
      logger.error('Failed to load seed data', {}, error as Error);
      throw error;
    }
  }

  // Check database connectivity
  public async checkConnection(): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('count')
        .limit(1);

      return !error;
    } catch (error) {
      logger.error('Database connection check failed', {}, error as Error);
      return false;
    }
  }

  // Reset database (development only)
  public async resetDatabase(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Database reset is not allowed in production');
    }

    try {
      logger.info('Resetting database (development only)');

      // Drop all tables (be careful with this!)
      const dropTablesSQL = `
        DROP TABLE IF EXISTS analytics_events CASCADE;
        DROP TABLE IF EXISTS social_interactions CASCADE;
        DROP TABLE IF EXISTS research_contributions CASCADE;
        DROP TABLE IF EXISTS game_sessions CASCADE;
        DROP TABLE IF EXISTS game_progress CASCADE;
        DROP TABLE IF EXISTS ai_research_problems CASCADE;
        DROP TABLE IF EXISTS subscriptions CASCADE;
        DROP TABLE IF EXISTS users CASCADE;
        DROP TABLE IF EXISTS _migrations CASCADE;
        DROP TYPE IF EXISTS subscription_tier CASCADE;
        DROP TYPE IF EXISTS problem_type CASCADE;
        DROP TYPE IF EXISTS validation_status CASCADE;
        DROP TYPE IF EXISTS social_interaction_type CASCADE;
      `;

      await this.supabase.rpc('exec_sql', { sql: dropTablesSQL });

      logger.info('Database reset completed');
    } catch (error) {
      logger.error('Database reset failed', {}, error as Error);
      throw error;
    }
  }
}

class DatabaseCLI {
  private dbSetup = new DatabaseSetup();

  private async executeMigrateCommand(): Promise<void> {
    await this.dbSetup.runMigrations();
  }

  private async executeSeedCommand(): Promise<void> {
    await this.dbSetup.loadSeedData();
  }

  private async executeSetupCommand(): Promise<void> {
    await this.dbSetup.runMigrations();
    await this.dbSetup.loadSeedData();
  }

  private async executeResetCommand(): Promise<void> {
    if (process.env.NODE_ENV !== 'production') {
      await this.dbSetup.resetDatabase();
      await this.dbSetup.runMigrations();
      await this.dbSetup.loadSeedData();
    } else {
      logger.error('Reset command not allowed in production');
      process.exit(1);
    }
  }

  private async executeCheckCommand(): Promise<void> {
    const isConnected = await this.dbSetup.checkConnection();
    if (isConnected) {
      logger.info('Database connection successful');
      process.exit(0);
    } else {
      logger.error('Database connection failed');
      process.exit(1);
    }
  }

  private showUsage(): void {
    console.log('Usage: npm run db <command>');
    console.log('Commands:');
    console.log('  migrate  - Run pending migrations');
    console.log('  seed     - Load seed data');
    console.log('  setup    - Run migrations and load seed data');
    console.log('  reset    - Reset database and reload (dev only)');
    console.log('  check    - Check database connection');
    process.exit(1);
  }

  public async run(args: string[]): Promise<void> {
    const command = args[0];

    try {
      switch (command) {
        case 'migrate':
          await this.executeMigrateCommand();
          break;
        case 'seed':
          await this.executeSeedCommand();
          break;
        case 'setup':
          await this.executeSetupCommand();
          break;
        case 'reset':
          await this.executeResetCommand();
          break;
        case 'check':
          await this.executeCheckCommand();
          break;
        default:
          this.showUsage();
      }
    } catch (error) {
      logger.error('Database setup failed', {}, error as Error);
      process.exit(1);
    }
  }
}

// CLI interface
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const cli = new DatabaseCLI();
  await cli.run(args);
}

// Run if called directly
if (require.main === module) {
  main();
}

export { DatabaseSetup };
