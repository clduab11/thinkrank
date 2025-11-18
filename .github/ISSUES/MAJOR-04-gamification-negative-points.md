# [MAJOR] Gamification Negative Point Calculation Bug

## Labels
`major`, `bug`, `gamification`, `scoring`, `pr-9`

## Priority
🟡 **MAJOR** - High priority

## Description
Point calculation formula allows negative scores when users take significantly longer than the time limit, resulting in poor user experience and incorrect leaderboard rankings.

## Current Behavior
```typescript
points = basePoints - (timeTaken - timeLimit)
// Example: basePoints=100, timeLimit=60s, timeTaken=180s
// Result: 100 - (180 - 60) = -20 points ❌
```

## Expected Behavior
- Points should never be negative
- Minimum points threshold should be maintained (e.g., 10% of base)
- Time penalty should have a cap (e.g., maximum 90% penalty)
- Scoring should feel fair and motivating

## Impact
- **Severity:** MEDIUM-HIGH
- **User Experience:** Demotivating negative scores
- **Game Balance:** Unfair punishment for slow completion
- **Leaderboard:** Incorrect rankings with negative scores

## Files Affected
- `backend/services/game-service/src/services/gamification-service.ts` (estimated)
- `backend/services/game-service/src/services/scoring-service.ts` (estimated)

## Examples of Issues

### Case 1: Significant Timeout
```typescript
calculatePoints(100, 180, 60)
// Current: -20 points
// Expected: 10 points (minimum)
```

### Case 2: Just Over Time Limit
```typescript
calculatePoints(100, 65, 60)
// Current: 95 points ✅
// Expected: 95 points ✅
```

### Case 3: Edge Case - Very Long Time
```typescript
calculatePoints(100, 600, 60)
// Current: -440 points ❌
// Expected: 10 points (minimum)
```

## Proposed Solution

### Option 1: Simple Non-Negative Clamping
```typescript
// ❌ CURRENT
calculatePoints(basePoints: number, timeTaken: number, timeLimit: number): number {
  return basePoints - (timeTaken - timeLimit);
}

// ✅ SIMPLE FIX
calculatePoints(basePoints: number, timeTaken: number, timeLimit: number): number {
  const timePenalty = Math.max(0, timeTaken - timeLimit);
  const points = basePoints - timePenalty;
  return Math.max(0, points);
}
```

### Option 2: Percentage-Based with Minimum (RECOMMENDED)
```typescript
interface ScoringConfig {
  basePoints: number;
  minPointsPercentage: number; // e.g., 0.1 for 10%
  maxPenaltyPercentage: number; // e.g., 0.9 for 90%
}

const DEFAULT_CONFIG: ScoringConfig = {
  basePoints: 100,
  minPointsPercentage: 0.1,
  maxPenaltyPercentage: 0.9
};

calculatePoints(
  basePoints: number,
  timeTaken: number,
  timeLimit: number,
  config: ScoringConfig = DEFAULT_CONFIG
): number {
  // Full points if within time limit
  if (timeTaken <= timeLimit) {
    return basePoints;
  }

  // Calculate time overage as percentage
  const overageRatio = (timeTaken - timeLimit) / timeLimit;

  // Calculate penalty (capped at max penalty percentage)
  const penaltyRatio = Math.min(overageRatio, config.maxPenaltyPercentage);
  const penalty = basePoints * penaltyRatio;

  // Calculate final points
  const points = basePoints - penalty;

  // Ensure minimum points threshold
  const minPoints = basePoints * config.minPointsPercentage;
  return Math.max(Math.floor(points), Math.floor(minPoints));
}
```

### Option 3: Exponential Decay (Advanced)
```typescript
/**
 * Exponential decay scoring - more forgiving for slight overages
 */
calculatePointsWithDecay(
  basePoints: number,
  timeTaken: number,
  timeLimit: number,
  decayRate = 0.1
): number {
  if (timeTaken <= timeLimit) {
    return basePoints;
  }

  const overageSeconds = timeTaken - timeLimit;

  // Exponential decay: points = basePoints * e^(-decayRate * overage)
  const decayFactor = Math.exp(-decayRate * (overageSeconds / timeLimit));
  const points = basePoints * decayFactor;

  // Minimum 10% of base points
  const minPoints = basePoints * 0.1;
  return Math.max(Math.floor(points), Math.floor(minPoints));
}
```

## Testing Examples

### Test Suite
```typescript
// backend/services/game-service/src/services/__tests__/gamification-service.test.ts

describe('GamificationService - Point Calculation', () => {
  describe('calculatePoints', () => {
    it('should award full points when within time limit', () => {
      const points = calculatePoints(100, 50, 60);
      expect(points).toBe(100);
    });

    it('should penalize overtime proportionally', () => {
      // 20% over time = 20% penalty
      const points = calculatePoints(100, 72, 60);
      expect(points).toBeLessThan(100);
      expect(points).toBeGreaterThan(70);
    });

    it('should never return negative points', () => {
      const points = calculatePoints(100, 600, 60);
      expect(points).toBeGreaterThanOrEqual(0);
    });

    it('should enforce minimum point threshold', () => {
      const points = calculatePoints(100, 1000, 60);
      expect(points).toBeGreaterThanOrEqual(10); // 10% minimum
    });

    it('should cap penalty at maximum', () => {
      const points1 = calculatePoints(100, 600, 60);
      const points2 = calculatePoints(100, 6000, 60);
      expect(points1).toBe(points2); // Both should hit minimum
    });

    it('should handle edge case: zero time limit', () => {
      const points = calculatePoints(100, 10, 0);
      expect(points).toBeGreaterThanOrEqual(10);
    });

    it('should handle edge case: zero time taken', () => {
      const points = calculatePoints(100, 0, 60);
      expect(points).toBe(100);
    });
  });

  describe('Point Distribution Fairness', () => {
    it('should have smooth point curve', () => {
      const timeLimit = 60;
      const testCases = [60, 70, 90, 120, 180, 300];
      const points = testCases.map(time =>
        calculatePoints(100, time, timeLimit)
      );

      // Points should decrease monotonically
      for (let i = 1; i < points.length; i++) {
        expect(points[i]).toBeLessThanOrEqual(points[i - 1]);
      }
    });
  });
});
```

## Acceptance Criteria
- [ ] Fix point calculation to prevent negative values
- [ ] Implement minimum point threshold (10% of base points)
- [ ] Implement maximum penalty cap (90% of base points)
- [ ] Add comprehensive unit tests (edge cases, fairness)
- [ ] Update scoring documentation
- [ ] Add visual scoring curve to documentation
- [ ] Migrate existing scores (if needed)
- [ ] A/B test new scoring with beta users
- [ ] Monitor score distribution after deployment

## Migration Plan

### Data Migration
```typescript
// Migrate existing negative scores
async migrateNegativeScores(): Promise<void> {
  const negativeScores = await db.scores
    .where('points')
    .lessThan(0)
    .findMany();

  for (const score of negativeScores) {
    // Recalculate with new formula
    const newPoints = calculatePoints(
      score.basePoints,
      score.timeTaken,
      score.timeLimit
    );

    await db.scores.update({
      where: { id: score.id },
      data: {
        points: newPoints,
        migratedAt: new Date(),
        migrationReason: 'Negative score fix'
      }
    });
  }

  logger.info(`Migrated ${negativeScores.length} negative scores`);
}
```

## User Communication
```markdown
## Scoring System Update

We've updated our scoring system to be more fair and motivating:

**What Changed:**
- Scores are now always positive (minimum 10 points)
- Time penalties are capped at 90% of base points
- More gradual penalty curve for overtime completion

**Why:**
- Better reflects effort and completion
- More motivating for learning
- Fairer leaderboard competition

**Impact on You:**
- Existing negative scores have been recalculated
- Your ranking may have changed slightly
- Future challenges use the improved formula
```

## Estimated Effort
2 hours (development) + 1 hour (testing) + 1 hour (migration)

## Related Issues
- PR #9: Repository analysis
- Game balance and progression system
- Leaderboard ranking accuracy

## References
- Game Design Patterns: Scoring Systems
- UX Psychology: Motivation and Rewards
- Similar implementations in Duolingo, Khan Academy
