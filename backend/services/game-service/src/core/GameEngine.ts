/**
 * ThinkRank Core Game Engine
 * Main orchestration engine for gamified AI literacy platform
 *
 * RESPONSIBILITIES:
 * - Game state orchestration and lifecycle management
 * - Player action processing and validation
 * - Real-time event coordination
 * - Cross-service communication
 *
 * INTEGRATION POINTS:
 * - StateManager: Optimistic state updates
 * - EventSystem: Real-time event broadcasting
 * - AIAgentManager: Adaptive AI decision making
 * - SocialService: Achievement and leaderboard updates
 */

import { EventEmitter } from 'events';
import { StateManager } from './StateManager';
import { EventSystem } from './EventSystem';
import { AIAgentManager } from './AIAgentManager';
import { GachaSystem } from '../progression/GachaSystem';
import { SocialManager } from '../social/SocialManager';

export interface GameConfig {
  maxPlayers: number;
  gameRules: GameRules;
  aiConfig: AIConfiguration;
  gachaConfig: GachaConfiguration;
  socialConfig: SocialConfiguration;
}

export interface GameState {
  gameId: string;
  players: Map<string, PlayerState>;
  currentPhase: GamePhase;
  boardState: any;
  aiAgents: Map<string, AIAgentState>;
  timestamp: Date;
  version: number;
}

export interface PlayerState {
  playerId: string;
  level: number;
  experience: number;
  collection: Collection;
  progression: PlayerProgression;
  socialMetrics: SocialMetrics;
  lastActive: Date;
}

export interface GameAction {
  type: ActionType;
  playerId: string;
  payload: any;
  timestamp: Date;
  clientId?: string;
}

export enum GamePhase {
  WAITING_FOR_PLAYERS = 'waiting',
  ACTIVE_GAMEPLAY = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed'
}

export enum ActionType {
  // Core game actions
  PERFORM_GACHA_PULL = 'gacha_pull',
  SUBMIT_CHALLENGE_ANSWER = 'challenge_answer',
  UPDATE_COLLECTION = 'update_collection',

  // Social actions
  SHARE_ACHIEVEMENT = 'share_achievement',
  SEND_FRIEND_REFERRAL = 'send_referral',

  // Research actions
  START_RESEARCH_WORKFLOW = 'start_research',
  SUBMIT_RESEARCH_STEP = 'submit_research_step'
}

export class GameEngine extends EventEmitter {
  private gameId: string;
  private config: GameConfig;
  private stateManager: StateManager;
  private eventSystem: EventSystem;
  private aiAgentManager: AIAgentManager;
  private gachaSystem: GachaSystem;
  private socialManager: SocialManager;
  private isInitialized: boolean = false;
  private performanceMetrics: PerformanceMetrics;

  constructor(gameId: string, config: GameConfig) {
    super();
    this.gameId = gameId;
    this.config = config;
    this.performanceMetrics = new PerformanceMetrics();

    // Initialize subsystems
    this.stateManager = new StateManager(config);
    this.eventSystem = new EventSystem(config);
    this.aiAgentManager = new AIAgentManager(config.aiConfig);
    this.gachaSystem = new GachaSystem(config.gachaConfig);
    this.socialManager = new SocialManager(config.socialConfig);
  }

  /**
   * Initialize the game engine with starting state
   */
  async initialize(): Promise<GameState> {
    const startTime = Date.now();

    try {
      // Initialize subsystems
      await Promise.all([
        this.stateManager.initialize(),
        this.eventSystem.initialize(),
        this.aiAgentManager.initialize()
      ]);

      // Create initial game state
      const initialState: GameState = {
        gameId: this.gameId,
        players: new Map(),
        currentPhase: GamePhase.WAITING_FOR_PLAYERS,
        boardState: {},
        aiAgents: new Map(),
        timestamp: new Date(),
        version: 1
      };

      // Persist initial state
      await this.stateManager.saveState(initialState);

      this.isInitialized = true;
      this.performanceMetrics.recordInitialization(Date.now() - startTime);

      this.emit('engine:initialized', { gameId: this.gameId, state: initialState });
      return initialState;

    } catch (error) {
      this.performanceMetrics.recordError('initialization', error);
      throw new GameEngineError('Failed to initialize game engine', error);
    }
  }

  /**
   * Process a player action and update game state
   */
  async processAction(action: GameAction): Promise<GameState> {
    if (!this.isInitialized) {
      throw new GameEngineError('Game engine not initialized');
    }

    const startTime = Date.now();
    let updatedState: GameState;

    try {
      // Get current state with optimistic locking
      const currentState = await this.stateManager.getCurrentState(this.gameId);

      // Validate action
      await this.validateAction(action, currentState);

      // Process action based on type
      switch (action.type) {
        case ActionType.PERFORM_GACHA_PULL:
          updatedState = await this.processGachaPull(action, currentState);
          break;

        case ActionType.SUBMIT_CHALLENGE_ANSWER:
          updatedState = await this.processChallengeAnswer(action, currentState);
          break;

        case ActionType.SHARE_ACHIEVEMENT:
          updatedState = await this.processSocialShare(action, currentState);
          break;

        case ActionType.START_RESEARCH_WORKFLOW:
          updatedState = await this.processResearchStart(action, currentState);
          break;

        default:
          throw new GameEngineError(`Unknown action type: ${action.type}`);
      }

      // Save updated state
      await this.stateManager.saveState(updatedState);

      // Broadcast state changes to all players
      await this.eventSystem.broadcastStateChange(updatedState, action.playerId);

      // Record performance metrics
      this.performanceMetrics.recordAction(action.type, Date.now() - startTime);

      // Emit action processed event
      this.emit('action:processed', {
        gameId: this.gameId,
        action,
        newState: updatedState
      });

      return updatedState;

    } catch (error) {
      this.performanceMetrics.recordError('action_processing', error);
      this.emit('action:error', { action, error });
      throw error;
    }
  }

  /**
   * Process gacha pull action
   */
  private async processGachaPull(action: GameAction, currentState: GameState): Promise<GameState> {
    const playerId = action.playerId;
    const player = currentState.players.get(playerId);

    if (!player) {
      throw new GameEngineError(`Player ${playerId} not found in game`);
    }

    // Perform gacha pull
    const pullResult = await this.gachaSystem.performPull(playerId, action.payload.pullType);

    // Update player collection and progression
    const updatedPlayer = await this.gachaSystem.updatePlayerAfterPull(player, pullResult);

    // Check for new achievements
    const newAchievements = await this.socialManager.checkAchievements(playerId, updatedPlayer);

    // Update player state
    const updatedPlayers = new Map(currentState.players);
    updatedPlayers.set(playerId, {
      ...updatedPlayer,
      socialMetrics: await this.socialManager.updateSocialMetrics(playerId, newAchievements)
    });

    return {
      ...currentState,
      players: updatedPlayers,
      timestamp: new Date(),
      version: currentState.version + 1
    };
  }

  /**
   * Process challenge answer submission
   */
  private async processChallengeAnswer(action: GameAction, currentState: GameState): Promise<GameState> {
    const playerId = action.playerId;
    const { challengeId, answer } = action.payload;

    // Get AI agent response for validation
    const validation = await this.aiAgentManager.validateChallengeAnswer(
      challengeId,
      answer,
      currentState
    );

    // Update player progression based on validation
    const player = currentState.players.get(playerId);
    if (!player) {
      throw new GameEngineError(`Player ${playerId} not found`);
    }

    const updatedProgression = await this.calculateProgressionUpdate(
      player.progression,
      validation
    );

    const updatedPlayers = new Map(currentState.players);
    updatedPlayers.set(playerId, {
      ...player,
      progression: updatedProgression,
      experience: player.experience + validation.experienceGained
    });

    return {
      ...currentState,
      players: updatedPlayers,
      timestamp: new Date(),
      version: currentState.version + 1
    };
  }

  /**
   * Process social sharing action
   */
  private async processSocialShare(action: GameAction, currentState: GameState): Promise<GameState> {
    const playerId = action.playerId;
    const { achievementId, platform } = action.payload;

    // Record social share
    const shareResult = await this.socialManager.recordSocialShare(
      playerId,
      achievementId,
      platform
    );

    // Update viral metrics
    await this.socialManager.updateViralMetrics(playerId, shareResult);

    // Award referral bonuses if applicable
    if (shareResult.referralCount > 0) {
      const player = currentState.players.get(playerId);
      if (player) {
        const referralBonus = await this.socialManager.calculateReferralBonus(
          shareResult.referralCount
        );

        const updatedPlayers = new Map(currentState.players);
        updatedPlayers.set(playerId, {
          ...player,
          progression: await this.applyReferralBonus(player.progression, referralBonus)
        });

        return {
          ...currentState,
          players: updatedPlayers,
          timestamp: new Date(),
          version: currentState.version + 1
        };
      }
    }

    return currentState;
  }

  /**
   * Process research workflow start
   */
  private async processResearchStart(action: GameAction, currentState: GameState): Promise<GameState> {
    const playerId = action.playerId;
    const { researchType, difficulty } = action.payload;

    // Generate research workflow
    const workflow = await this.aiAgentManager.generateResearchWorkflow(
      researchType,
      difficulty,
      currentState
    );

    // Initialize player research state
    const player = currentState.players.get(playerId);
    if (!player) {
      throw new GameEngineError(`Player ${playerId} not found`);
    }

    const updatedPlayers = new Map(currentState.players);
    updatedPlayers.set(playerId, {
      ...player,
      progression: {
        ...player.progression,
        activeWorkflow: workflow
      }
    });

    return {
      ...currentState,
      players: updatedPlayers,
      timestamp: new Date(),
      version: currentState.version + 1
    };
  }

  /**
   * Validate action against current game state
   */
  private async validateAction(action: GameAction, gameState: GameState): Promise<void> {
    const player = gameState.players.get(action.playerId);
    if (!player) {
      throw new GameEngineError(`Player ${action.playerId} not found in game`);
    }

    // Validate based on action type
    switch (action.type) {
      case ActionType.PERFORM_GACHA_PULL:
        await this.gachaSystem.validatePull(player, action.payload.pullType);
        break;

      case ActionType.SUBMIT_CHALLENGE_ANSWER:
        await this.aiAgentManager.validateChallengeSubmission(
          action.payload.challengeId,
          player
        );
        break;

      case ActionType.SHARE_ACHIEVEMENT:
        await this.socialManager.validateSocialShare(
          action.payload.achievementId,
          player
        );
        break;
    }
  }

  /**
   * Calculate progression update based on validation result
   */
  private async calculateProgressionUpdate(
    currentProgression: PlayerProgression,
    validation: ValidationResult
  ): Promise<PlayerProgression> {
    const newExperience = currentProgression.experience + validation.experienceGained;

    return {
      ...currentProgression,
      experience: newExperience,
      level: Math.floor(newExperience / 1000) + 1, // Level up every 1000 XP
      challengesCompleted: currentProgression.challengesCompleted + 1,
      accuracySum: currentProgression.accuracySum + validation.accuracy,
      averageAccuracy: (currentProgression.accuracySum + validation.accuracy) /
                     (currentProgression.challengesCompleted + 1)
    };
  }

  /**
   * Apply referral bonus to player progression
   */
  private async applyReferralBonus(
    progression: PlayerProgression,
    bonus: ReferralBonus
  ): Promise<PlayerProgression> {
    return {
      ...progression,
      experience: progression.experience + bonus.experienceBonus,
      referralCount: progression.referralCount + bonus.referralCount
    };
  }

  /**
   * Get current game state
   */
  async getCurrentState(): Promise<GameState> {
    return await this.stateManager.getCurrentState(this.gameId);
  }

  /**
   * Get player-specific state
   */
  async getPlayerState(playerId: string): Promise<PlayerState | null> {
    const gameState = await this.getCurrentState();
    return gameState.players.get(playerId) || null;
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return this.performanceMetrics;
  }

  /**
   * Shutdown game engine
   */
  async shutdown(): Promise<void> {
    await Promise.all([
      this.stateManager.cleanup(),
      this.eventSystem.cleanup(),
      this.aiAgentManager.cleanup()
    ]);

    this.emit('engine:shutdown', { gameId: this.gameId });
  }
}

// Supporting interfaces and classes
export interface GameRules {
  maxGameDuration: number;
  maxPlayers: number;
  allowedActions: ActionType[];
  scoringRules: ScoringRules;
}

export interface AIConfiguration {
  biasDetectionModel: string;
  adaptiveDifficultyEnabled: boolean;
  responseLatencyTarget: number;
}

export interface GachaConfiguration {
  pullCosts: Map<string, number>;
  dropRates: Map<string, number>;
  pitySystemEnabled: boolean;
  maxDailyPulls: number;
}

export interface SocialConfiguration {
  achievementSharingEnabled: boolean;
  referralBonusEnabled: boolean;
  leaderboardUpdateFrequency: number;
}

export interface Collection {
  items: Map<string, CollectionItem>;
  totalItems: number;
  completionPercentage: number;
  lastUpdated: Date;
}

export interface PlayerProgression {
  level: number;
  experience: number;
  challengesCompleted: number;
  accuracySum: number;
  averageAccuracy: number;
  referralCount: number;
  activeWorkflow?: ResearchWorkflow;
}

export interface SocialMetrics {
  totalShares: number;
  totalReferrals: number;
  viralCoefficient: number;
  leaderboardRank: number;
}

export interface ValidationResult {
  isCorrect: boolean;
  accuracy: number;
  experienceGained: number;
  feedback: string;
  hints?: string[];
}

export interface ReferralBonus {
  experienceBonus: number;
  referralCount: number;
  bonusMultiplier: number;
}

export interface ResearchWorkflow {
  id: string;
  type: string;
  stages: WorkflowStage[];
  currentStage: number;
  progress: number;
  estimatedCompletion: Date;
}

export interface WorkflowStage {
  id: string;
  name: string;
  description: string;
  requiredActions: string[];
  rewards: number;
}

export class GameEngineError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = 'GameEngineError';
  }
}

export class PerformanceMetrics {
  private metrics: Map<string, number[]> = new Map();

  recordInitialization(duration: number): void {
    this.recordMetric('initialization', duration);
  }

  recordAction(actionType: string, duration: number): void {
    this.recordMetric(`action:${actionType}`, duration);
  }

  recordError(type: string, error: any): void {
    this.recordMetric(`error:${type}`, 1);
  }

  private recordMetric(key: string, value: number): void {
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    this.metrics.get(key)!.push(value);
  }

  getAverageLatency(actionType?: string): number {
    const key = actionType ? `action:${actionType}` : 'initialization';
    const values = this.metrics.get(key) || [];
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  getErrorCount(type?: string): number {
    const key = type ? `error:${type}` : 'error';
    return (this.metrics.get(key) || []).reduce((sum, val) => sum + val, 0);
  }
}