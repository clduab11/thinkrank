# Game Service Domain Model

## 1. Core Domain Entities

### 1.1 Player Entity
**Primary Entity**: Represents a game participant with progression tracking.

```typescript
interface Player {
  id: string;                    // UUID, primary key
  userId: string;               // Reference to authentication user
  displayName: string;          // Player's chosen display name
  email: string;                // Player's email address
  avatar?: string;              // Optional avatar image URL

  // Progression State
  level: number;                // Current player level
  experience: number;           // Total accumulated experience
  experienceToNextLevel: number; // Experience needed for next level

  // Performance Metrics
  challengesCompleted: number;  // Total challenges completed
  averageAccuracy: number;      // Average answer accuracy (0-100)
  currentStreak: number;        // Current correct answer streak
  longestStreak: number;        // Best streak achieved

  // Social Features
  achievements: Achievement[];  // Earned achievements
  referralCode: string;         // Unique referral code
  referredBy?: string;          // Player ID who referred this player
  totalReferrals: number;       // Number of successful referrals

  // Collection System
  collection: Collection;       // Items and rewards collected

  // Research State
  activeWorkflows: ResearchWorkflow[]; // Currently active research
  completedWorkflows: ResearchWorkflow[]; // Completed research

  // Timestamps
  createdAt: Date;              // Account creation date
  lastActiveAt: Date;           // Last activity timestamp
  lastChallengeAt?: Date;       // Last challenge completion

  // Preferences
  preferences: PlayerPreferences; // UI and gameplay preferences
}
```

### 1.2 Challenge Entity
**Primary Entity**: Represents an AI-generated challenge or question.

```typescript
interface Challenge {
  id: string;                   // UUID, primary key
  type: ChallengeType;          // Type of challenge (bias_detection, logic, etc.)
  category: string;            // Topic category (cognitive_bias, logic, etc.)
  difficulty: DifficultyLevel;  // Difficulty level (easy, medium, hard, expert)

  // Content
  question: string;            // The challenge question text
  context?: string;            // Additional context or scenario
  options: string[];           // Available answer options
  correctAnswer: string;       // Correct answer identifier
  explanation: string;         // Educational explanation

  // AI Analysis
  biasTypes: string[];         // Cognitive biases being tested
  learningObjectives: string[]; // Learning goals addressed
  tags: string[];              // Search and filtering tags

  // Metadata
  generatedBy: string;          // AI model/agent that generated it
  estimatedDuration: number;   // Expected completion time in seconds
  points: number;              // Base points for correct answer

  // State
  isActive: boolean;           // Whether challenge is available
  usageCount: number;          // How many times used
  successRate: number;         // Historical success rate (0-100)

  // Timestamps
  createdAt: Date;             // Challenge creation date
  lastUsedAt?: Date;           // Last time challenge was presented
}
```

### 1.3 Game Session Entity
**Primary Entity**: Represents an active game session.

```typescript
interface GameSession {
  id: string;                  // UUID, primary key
  playerId: string;            // Player participating in session

  // Session State
  status: SessionStatus;       // Session status (active, paused, completed)
  currentChallengeId?: string; // Currently active challenge
  score: number;               // Current session score
  accuracy: number;            // Session accuracy percentage

  // Progression Tracking
  challengesCompleted: number; // Challenges completed in session
  experienceGained: number;    // Experience earned in session
  itemsEarned: CollectionItem[]; // Items collected in session

  // Timing
  startedAt: Date;             // Session start time
  lastActivityAt: Date;        // Last player action
  completedAt?: Date;          // Session completion time
  duration: number;            // Total session duration in seconds

  // Configuration
  settings: SessionSettings;   // Session-specific settings
}
```

### 1.4 Achievement Entity
**Supporting Entity**: Represents player accomplishments and milestones.

```typescript
interface Achievement {
  id: string;                  // UUID, primary key
  playerId: string;            // Player who earned the achievement

  // Achievement Details
  type: AchievementType;       // Type of achievement
  name: string;                // Achievement display name
  description: string;         // Achievement description
  icon: string;                // Achievement icon identifier

  // Progress Tracking
  requirement: number;         // Required value to unlock
  currentProgress: number;     // Current progress toward requirement
  isCompleted: boolean;        // Whether achievement is unlocked

  // Rewards
  rewards: AchievementReward;  // Rewards granted when unlocked

  // Metadata
  rarity: AchievementRarity;   // How rare/common the achievement is
  category: string;            // Achievement category
  tags: string[];              // Search and categorization tags

  // Timestamps
  createdAt: Date;             // Achievement creation/recorded date
  completedAt?: Date;          // When achievement was unlocked
}
```

## 2. Supporting Domain Entities

### 2.1 Collection System
```typescript
interface Collection {
  playerId: string;            // Player who owns the collection

  // Collection State
  items: Map<string, CollectionItem>; // Owned items by ID
  totalItems: number;          // Total number of items owned
  completionPercentage: number; // Collection completion (0-100)

  // Categories
  categories: Map<string, CategoryProgress>; // Progress by category

  // Special Collections
  featuredItems: string[];     // Highlighted/special items
  recentAcquisitions: CollectionItem[]; // Recently obtained items

  // Statistics
  totalValue: number;          // Total estimated value
  rarityDistribution: Map<RarityLevel, number>; // Items by rarity

  lastUpdated: Date;           // Last collection update
}

interface CollectionItem {
  id: string;                  // Item unique identifier
  templateId: string;          // Reference to item template

  // Item Properties
  name: string;                // Item display name
  description: string;         // Item description
  category: string;            // Item category
  rarity: RarityLevel;         // Item rarity

  // Visual
  icon: string;                // Icon identifier
  animation?: string;          // Special animation identifier

  // Acquisition
  source: ItemSource;          // How item was obtained
  acquiredAt: Date;            // When item was obtained
  pullType?: string;           // Gacha pull type if applicable

  // Stats
  baseValue: number;           // Base value/points
  bonusStats?: ItemStats;      // Additional stat bonuses
}
```

### 2.2 Research Workflow System
```typescript
interface ResearchWorkflow {
  id: string;                  // UUID, primary key
  playerId: string;            // Player conducting research

  // Workflow Definition
  type: ResearchType;          // Type of research
  title: string;               // Research title
  description: string;         // Research description

  // Progress Tracking
  status: WorkflowStatus;      // Current workflow status
  currentStage: number;        // Current stage (0-indexed)
  totalStages: number;         // Total number of stages

  // Stages Definition
  stages: WorkflowStage[];     // All workflow stages
  completedStages: string[];   // IDs of completed stages

  // Results and Rewards
  findings: ResearchFinding[]; // Research discoveries
  rewards: WorkflowReward;     // Rewards for completion

  // Timing
  startedAt: Date;             // Research start time
  estimatedCompletion: Date;   // Expected completion date
  completedAt?: Date;          // Actual completion time

  // AI Configuration
  aiModel: string;             // AI model used for generation
  difficulty: DifficultyLevel; // Research difficulty
}

interface WorkflowStage {
  id: string;                  // Stage unique identifier
  name: string;                // Stage display name
  description: string;         // Stage description

  // Requirements
  requiredActions: string[];   // Actions needed to complete
  estimatedDuration: number;   // Expected time to complete

  // AI Guidance
  hints: string[];             // AI-provided hints
  learningObjectives: string[]; // What player should learn

  // Progress
  isCompleted: boolean;        // Whether stage is done
  completedAt?: Date;          // When stage was completed

  // Rewards
  stageRewards: StageReward;   // Rewards for stage completion
}
```

### 2.3 Social System
```typescript
interface SocialProfile {
  playerId: string;            // Player's ID

  // Social Metrics
  totalScore: number;          // Total accumulated score
  globalRank: number;          // Global leaderboard position
  categoryRanks: Map<string, number>; // Ranks by category

  // Social Activity
  friends: string[];           // Friend player IDs
  following: string[];         // Players being followed
  followers: string[];         // Players following this player

  // Sharing Activity
  totalShares: number;         // Total achievements shared
  totalLikes: number;          // Likes received on shares
  viralCoefficient: number;    // Social engagement metric

  // Preferences
  privacySettings: PrivacySettings; // Visibility preferences
  notificationSettings: NotificationSettings; // Social notifications
}
```

## 3. Domain Value Objects

### 3.1 Challenge Result
```typescript
interface ChallengeResult {
  challengeId: string;         // Challenge that was answered
  playerId: string;            // Player who answered
  sessionId: string;           // Game session context

  // Answer Details
  selectedAnswer: string;      // Player's chosen answer
  isCorrect: boolean;          // Whether answer was correct
  accuracy: number;            // Confidence/accuracy score (0-100)

  // Performance Metrics
  responseTime: number;        // Time taken to answer (seconds)
  timeBonus: number;           // Bonus points for fast answers

  // AI Analysis
  biasDetected: string[];      // Biases identified in response
  confidence: number;          // AI confidence in assessment
  feedback: string;            // Detailed feedback text

  // Rewards
  experienceGained: number;    // Experience points awarded
  itemsEarned: CollectionItem[]; // Items awarded
  streakBonus: number;         // Streak continuation bonus

  // Metadata
  answeredAt: Date;            // When answer was submitted
  validatedAt: Date;           // When AI validation completed
}
```

### 3.2 Game Configuration
```typescript
interface GameConfiguration {
  // Difficulty Settings
  difficultyProgression: DifficultyProgression;
  adaptiveDifficulty: boolean; // Enable dynamic difficulty

  // Scoring Configuration
  basePointsPerChallenge: number;
  accuracyMultiplier: number;
  speedBonusMultiplier: number;
  streakBonusFormula: string;

  // Gacha Configuration
  gachaEnabled: boolean;
  pullCosts: Map<PullType, number>;
  dailyPullLimits: Map<PullType, number>;

  // Social Features
  socialFeaturesEnabled: boolean;
  leaderboardEnabled: boolean;
  achievementSharingEnabled: boolean;

  // AI Configuration
  biasDetectionModel: string;
  challengeGenerationModel: string;
  adaptiveLearningEnabled: boolean;
}
```

## 4. Domain Events

### 4.1 Core Game Events
```typescript
interface ChallengeCompleted {
  eventId: string;             // UUID
  type: 'challenge.completed';

  playerId: string;            // Player who completed
  challengeId: string;         // Challenge completed
  sessionId: string;           // Game session context

  result: ChallengeResult;     // Complete result details
  newLevel?: number;           // If player leveled up
  achievements?: Achievement[]; // New achievements unlocked

  occurredAt: Date;            // When event happened
}

interface PlayerLeveledUp {
  eventId: string;             // UUID
  type: 'player.leveled_up';

  playerId: string;            // Player who leveled up
  oldLevel: number;            // Previous level
  newLevel: number;            // New level achieved
  experienceGained: number;    // Experience that triggered level up

  occurredAt: Date;            // When event happened
}

interface AchievementUnlocked {
  eventId: string;             // UUID
  type: 'achievement.unlocked';

  playerId: string;            // Player who unlocked
  achievementId: string;       // Achievement unlocked
  achievement: Achievement;    // Complete achievement details

  occurredAt: Date;            // When event happened
}
```

### 4.2 Social Events
```typescript
interface SocialShare {
  eventId: string;             // UUID
  type: 'social.shared';

  playerId: string;            // Player who shared
  achievementId: string;       // Achievement being shared
  platform: string;            // Social platform used

  shareUrl?: string;           // Generated share URL
  referralCode?: string;       // Referral code included

  occurredAt: Date;            // When event happened
}

interface ReferralCompleted {
  eventId: string;             // UUID
  type: 'referral.completed';

  referrerId: string;          // Player who made referral
  refereeId: string;           // Player who was referred
  referralCode: string;        // Referral code used

  rewards: ReferralReward;     // Rewards granted to both players

  occurredAt: Date;            // When event happened
}
```

## 5. Domain Services

### 5.1 Challenge Service
**Responsibility**: Manages challenge lifecycle and validation.

```typescript
interface ChallengeService {
  // Challenge Generation
  generateChallenge(playerId: string, criteria?: ChallengeCriteria): Promise<Challenge>;
  generateBatch(playerCount: number, criteria: BatchCriteria): Promise<Challenge[]>;

  // Challenge Validation
  validateAnswer(challengeId: string, answer: string, playerId: string): Promise<ValidationResult>;
  calculateScore(challenge: Challenge, result: ChallengeResult): Promise<ScoreCalculation>;

  // Challenge Management
  getChallenge(challengeId: string): Promise<Challenge>;
  getChallengesForPlayer(playerId: string, filters?: ChallengeFilters): Promise<Challenge[]>;
  retireChallenge(challengeId: string, reason: string): Promise<void>;
}
```

### 5.2 Progression Service
**Responsibility**: Manages player progression and experience.

```typescript
interface ProgressionService {
  // Experience Management
  calculateExperience(challengeResult: ChallengeResult): Promise<ExperienceCalculation>;
  applyExperience(playerId: string, experience: number): Promise<LevelProgression>;

  // Level Management
  calculateLevelProgress(player: Player): Promise<LevelProgression>;
  processLevelUp(playerId: string, newLevel: number): Promise<LevelUpResult>;

  // Statistics
  updatePlayerStats(playerId: string, result: ChallengeResult): Promise<PlayerStats>;
  getPlayerProgression(playerId: string): Promise<PlayerProgression>;
}
```

### 5.3 Collection Service
**Responsibility**: Manages player collections and gacha systems.

```typescript
interface CollectionService {
  // Gacha System
  performPull(playerId: string, pullType: PullType): Promise<PullResult>;
  validatePull(playerId: string, pullType: PullType): Promise<boolean>;

  // Collection Management
  addItem(playerId: string, item: CollectionItem): Promise<void>;
  getCollection(playerId: string): Promise<Collection>;
  updateCollectionProgress(playerId: string): Promise<CollectionProgress>;
}
```

## 6. Business Rules and Invariants

### 6.1 Player Progression Rules
- **PR-001**: Experience must always be non-negative
- **PR-002**: Player level must be calculated as `floor(experience / 1000) + 1`
- **PR-003**: Maximum level cap must be enforced (currently 100)
- **PR-004**: Experience gained must be at least 1 point per challenge
- **PR-005**: Streak bonuses must increase with streak length

### 6.2 Challenge Validation Rules
- **CV-001**: Answer validation must complete within 2 seconds
- **CV-002**: Challenge must be marked as used after presentation
- **CV-003**: Duplicate answers must be rejected within time window
- **CV-004**: AI confidence score must be above 70% for validation
- **CV-005**: Challenge must be retired if success rate < 10%

### 6.3 Collection System Rules
- **CS-001**: Pull costs must be positive and predefined
- **CS-002**: Daily pull limits must be enforced per player
- **CS-003**: Item rarity must affect drop probability
- **CS-004**: Pity system must guarantee rare items after N pulls
- **CS-005**: Collection completion must be calculated accurately

### 6.4 Social System Rules
- **SS-001**: Referral codes must be unique and non-guessable
- **SS-002**: Achievement sharing must respect privacy settings
- **SS-003**: Leaderboard rankings must be updated in real-time
- **SS-004**: Social actions must not affect core gameplay balance
- **SS-005**: Friend relationships must be bidirectional for full features

## 7. Aggregate Boundaries

### 7.1 Player Aggregate
**Consistency Boundary**: Player entity with all related data
- Player + Collection + Achievements + Social Profile
- Maintains consistency of player progression state
- Handles level ups, experience calculations, collection updates

### 7.2 Challenge Aggregate
**Consistency Boundary**: Challenge with validation results
- Challenge + Results + Performance Metrics
- Maintains challenge lifecycle and usage statistics
- Handles validation, scoring, and retirement logic

### 7.3 Game Session Aggregate
**Consistency Boundary**: Complete game session data
- Session + Results + Progression + Rewards
- Maintains session state consistency
- Handles scoring, timing, and completion logic

## 8. State Transitions

### 8.1 Challenge State Machine
```typescript
enum ChallengeStatus {
  DRAFT = 'draft',           // Being created by AI
  ACTIVE = 'active',         // Available for players
  ASSIGNED = 'assigned',     // Given to specific player
  COMPLETED = 'completed',   // Successfully answered
  FAILED = 'failed',         // Incorrectly answered
  RETIRED = 'retired'        // Removed from circulation
}

interface ChallengeStateTransitions {
  // From DRAFT
  DRAFT -> ACTIVE: challengeValidated

  // From ACTIVE
  ACTIVE -> ASSIGNED: playerRequested
  ACTIVE -> RETIRED: adminRetired | performanceThreshold

  // From ASSIGNED
  ASSIGNED -> COMPLETED: correctAnswer
  ASSIGNED -> FAILED: incorrectAnswer | timeout
  ASSIGNED -> ACTIVE: playerAbandoned

  // From COMPLETED/FAILED
  COMPLETED -> ACTIVE: reusedChallenge
  FAILED -> RETIRED: tooManyFailures
}
```

### 8.2 Player Progression State Machine
```typescript
enum PlayerStatus {
  NEW = 'new',               // Just registered
  ACTIVE = 'active',         // Regularly playing
  INACTIVE = 'inactive',     // Haven't played recently
  SUSPENDED = 'suspended'    // Temporarily suspended
}

interface PlayerProgressionTransitions {
  // From NEW
  NEW -> ACTIVE: firstChallengeCompleted

  // From ACTIVE
  ACTIVE -> INACTIVE: noActivity_7days
  ACTIVE -> SUSPENDED: violationDetected

  // From INACTIVE
  INACTIVE -> ACTIVE: challengeCompleted
  INACTIVE -> SUSPENDED: extendedInactivity

  // From SUSPENDED
  SUSPENDED -> ACTIVE: suspensionLifted
}
```

## 9. Domain Queries and Read Models

### 9.1 Player Dashboard Queries
```typescript
interface PlayerDashboard {
  player: PlayerSummary;
  recentActivity: ActivitySummary[];
  progression: ProgressionSummary;
  collection: CollectionSummary;
  social: SocialSummary;
  recommendations: Recommendation[];
}

interface PlayerSummary {
  id: string;
  displayName: string;
  level: number;
  avatar?: string;
  currentStreak: number;
  lastActiveAt: Date;
}

interface ProgressionSummary {
  experience: number;
  experienceToNextLevel: number;
  levelProgress: number;        // Percentage to next level
  recentAchievements: Achievement[];
  skillAssessments: SkillAssessment[];
}
```

### 9.2 Analytics Read Models
```typescript
interface PlayerAnalytics {
  playerId: string;
  timeframe: AnalyticsTimeframe;

  // Performance Metrics
  totalChallenges: number;
  averageAccuracy: number;
  improvementRate: number;
  timeSpent: number;

  // Engagement Metrics
  sessionCount: number;
  averageSessionDuration: number;
  featureUsage: Map<string, number>;

  // Social Metrics
  socialActivity: SocialActivityMetrics;
  leaderboardPerformance: LeaderboardMetrics;
}

interface ChallengeAnalytics {
  challengeId: string;
  timeframe: AnalyticsTimeframe;

  // Usage Statistics
  timesPresented: number;
  completionRate: number;
  averageTimeToComplete: number;

  // Performance Data
  successByDifficulty: Map<DifficultyLevel, number>;
  commonIncorrectAnswers: string[];
  biasDetectionEffectiveness: number;
}
```

## 10. Domain Glossary

| Term | Definition |
|------|------------|
| **Cognitive Bias** | Systematic pattern of deviation from rational judgment |
| **Gacha Pull** | Random reward mechanism similar to loot boxes |
| **Pity System** | Guaranteed reward after N unsuccessful attempts |
| **Streak Bonus** | Increased rewards for consecutive successes |
| **Adaptive Difficulty** | Dynamic adjustment of challenge difficulty |
| **Research Workflow** | Guided learning journey through complex topics |
| **Viral Coefficient** | Measure of social sharing and engagement |
| **Collection Completion** | Percentage of available items obtained |
| **Experience Multiplier** | Bonus experience for special conditions |
| **Bias Detection** | AI identification of cognitive biases in responses |

## 11. Business Constraints

### 11.1 Performance Constraints
- Challenge generation: < 2 seconds
- Answer validation: < 500ms
- State updates: < 100ms
- Leaderboard queries: < 1 second

### 11.2 Scalability Constraints
- Support 10,000 concurrent players
- Handle 1,000 challenges per minute
- Store 1M+ challenge results
- Process 100 social actions per second

### 11.3 Data Consistency Constraints
- Player state must be eventually consistent
- Challenge results must be strongly consistent
- Social metrics must be updated within 5 minutes
- Collection state must be consistent across sessions

This domain model provides a comprehensive foundation for the Game Service implementation, defining clear boundaries, relationships, and behaviors that will guide the pseudocode design phase.