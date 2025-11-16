/**
 * Migration: Fix Negative Scores
 *
 * Migrates existing negative scores to use the new point calculation formula
 * with proper minimum thresholds and penalty caps.
 *
 * @see Issue #4: MAJOR - Gamification Negative Point Calculation Bug
 * @created 2024-11-16
 */

import { calculatePoints } from '../services/gamification-service';

/**
 * Score record interface (simplified)
 */
export interface ScoreRecord {
  id: string;
  userId: string;
  challengeId: string;
  points: number;
  basePoints: number;
  timeTaken: number;
  timeLimit: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Migration result
 */
export interface MigrationResult {
  /** Number of scores processed */
  totalProcessed: number;
  /** Number of scores updated */
  totalUpdated: number;
  /** Number of scores that were already valid */
  alreadyValid: number;
  /** Scores that had errors during migration */
  errors: Array<{ scoreId: string; error: string }>;
  /** Migration duration in milliseconds */
  durationMs: number;
}

/**
 * Migration statistics
 */
export interface MigrationStats {
  /** Total negative scores found */
  negativeScores: number;
  /** Total zero scores found */
  zeroScores: number;
  /** Average points before migration */
  avgPointsBefore: number;
  /** Average points after migration */
  avgPointsAfter: number;
  /** Point distribution */
  distribution: {
    /** Scores below 10 points */
    below10: number;
    /** Scores 10-50 points */
    between10And50: number;
    /** Scores 50-90 points */
    between50And90: number;
    /** Scores above 90 points */
    above90: number;
  };
}

/**
 * Database interface (to be implemented with actual DB)
 */
export interface ScoreDatabase {
  /** Find scores matching criteria */
  findScores(criteria: { points?: { lessThan?: number; equals?: number } }): Promise<ScoreRecord[]>;
  /** Update a score record */
  updateScore(scoreId: string, updates: Partial<ScoreRecord>): Promise<void>;
  /** Batch update scores */
  batchUpdate(updates: Array<{ id: string; data: Partial<ScoreRecord> }>): Promise<void>;
}

/**
 * Logger interface
 */
export interface Logger {
  info(message: string, context?: any): void;
  error(message: string, context?: any): void;
  warn(message: string, context?: any): void;
}

/**
 * Calculate new score using corrected formula
 *
 * @param record - Original score record
 * @returns New calculated points
 */
export function recalculateScore(record: ScoreRecord): number {
  return calculatePoints(
    record.basePoints || 100, // Default to 100 if not set
    record.timeTaken,
    record.timeLimit
  );
}

/**
 * Migrate negative scores to positive values
 *
 * @param db - Database interface
 * @param logger - Logger interface
 * @param dryRun - If true, only log changes without updating database
 * @returns Migration result
 */
export async function migrateNegativeScores(
  db: ScoreDatabase,
  logger: Logger,
  dryRun = false
): Promise<MigrationResult> {
  const startTime = Date.now();

  logger.info('Starting negative score migration', { dryRun });

  const result: MigrationResult = {
    totalProcessed: 0,
    totalUpdated: 0,
    alreadyValid: 0,
    errors: [],
    durationMs: 0
  };

  try {
    // Find all negative scores
    const negativeScores = await db.findScores({
      points: { lessThan: 0 }
    });

    logger.info(`Found ${negativeScores.length} negative scores to migrate`);

    const updates: Array<{ id: string; data: Partial<ScoreRecord> }> = [];

    for (const score of negativeScores) {
      result.totalProcessed++;

      try {
        // Recalculate with new formula
        const newPoints = recalculateScore(score);

        if (dryRun) {
          logger.info('Dry run - would update score', {
            scoreId: score.id,
            oldPoints: score.points,
            newPoints,
            improvement: newPoints - score.points
          });
        } else {
          updates.push({
            id: score.id,
            data: {
              points: newPoints,
              updatedAt: new Date()
            }
          });
        }

        result.totalUpdated++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Error recalculating score', {
          scoreId: score.id,
          error: errorMessage
        });

        result.errors.push({
          scoreId: score.id,
          error: errorMessage
        });
      }
    }

    // Batch update if not dry run
    if (!dryRun && updates.length > 0) {
      await db.batchUpdate(updates);
      logger.info(`Updated ${updates.length} scores`);
    }

    result.durationMs = Date.now() - startTime;

    logger.info('Migration completed', {
      totalProcessed: result.totalProcessed,
      totalUpdated: result.totalUpdated,
      errors: result.errors.length,
      durationMs: result.durationMs
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Migration failed', { error: errorMessage });
    throw error;
  }
}

/**
 * Migrate all scores (including valid ones) to ensure consistency
 *
 * @param db - Database interface
 * @param logger - Logger interface
 * @param dryRun - If true, only log changes without updating database
 * @returns Migration result
 */
export async function migrateAllScores(
  db: ScoreDatabase,
  logger: Logger,
  dryRun = false
): Promise<MigrationResult> {
  const startTime = Date.now();

  logger.info('Starting full score migration', { dryRun });

  const result: MigrationResult = {
    totalProcessed: 0,
    totalUpdated: 0,
    alreadyValid: 0,
    errors: [],
    durationMs: 0
  };

  try {
    // Find all scores (both negative and zero)
    const negativeScores = await db.findScores({ points: { lessThan: 0 } });
    const zeroScores = await db.findScores({ points: { equals: 0 } });
    const allScores = [...negativeScores, ...zeroScores];

    logger.info(`Found ${allScores.length} scores to review`, {
      negative: negativeScores.length,
      zero: zeroScores.length
    });

    const updates: Array<{ id: string; data: Partial<ScoreRecord> }> = [];

    for (const score of allScores) {
      result.totalProcessed++;

      try {
        const newPoints = recalculateScore(score);

        if (newPoints !== score.points) {
          if (dryRun) {
            logger.info('Dry run - would update score', {
              scoreId: score.id,
              oldPoints: score.points,
              newPoints,
              change: newPoints - score.points
            });
          } else {
            updates.push({
              id: score.id,
              data: {
                points: newPoints,
                updatedAt: new Date()
              }
            });
          }
          result.totalUpdated++;
        } else {
          result.alreadyValid++;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Error recalculating score', {
          scoreId: score.id,
          error: errorMessage
        });

        result.errors.push({
          scoreId: score.id,
          error: errorMessage
        });
      }
    }

    // Batch update if not dry run
    if (!dryRun && updates.length > 0) {
      await db.batchUpdate(updates);
      logger.info(`Updated ${updates.length} scores`);
    }

    result.durationMs = Date.now() - startTime;

    logger.info('Migration completed', result);

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Migration failed', { error: errorMessage });
    throw error;
  }
}

/**
 * Generate migration statistics
 *
 * @param db - Database interface
 * @returns Migration statistics
 */
export async function generateMigrationStats(
  db: ScoreDatabase
): Promise<MigrationStats> {
  const negativeScores = await db.findScores({ points: { lessThan: 0 } });
  const zeroScores = await db.findScores({ points: { equals: 0 } });

  const allScores = [...negativeScores, ...zeroScores];

  // Calculate new points for all scores
  const newPoints = allScores.map(score => recalculateScore(score));

  const avgPointsBefore =
    allScores.reduce((sum, score) => sum + score.points, 0) / allScores.length;
  const avgPointsAfter = newPoints.reduce((sum, points) => sum + points, 0) / newPoints.length;

  // Distribution
  const distribution = {
    below10: newPoints.filter(p => p < 10).length,
    between10And50: newPoints.filter(p => p >= 10 && p < 50).length,
    between50And90: newPoints.filter(p => p >= 50 && p < 90).length,
    above90: newPoints.filter(p => p >= 90).length
  };

  return {
    negativeScores: negativeScores.length,
    zeroScores: zeroScores.length,
    avgPointsBefore,
    avgPointsAfter,
    distribution
  };
}
