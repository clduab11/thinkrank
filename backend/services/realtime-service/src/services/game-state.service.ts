import { RedisManager } from './redis.service';
import { EventBroker, DomainEvent } from './event-broker.service';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@thinkrank/shared';

export interface GameState {
  id: string;
  type: 'bias-detection' | 'alignment-test' | 'context-evaluation';
  status: 'waiting' | 'active' | 'paused' | 'completed';
  players: GamePlayer[];
  currentRound: number;
  totalRounds: number;
  startTime?: Date;
  endTime?: Date;
  configuration: GameConfiguration;
  state: any; // Game-specific state
  version: number;
  lastUpdated: Date;
}

export interface GamePlayer {
  id: string;
  username: string;
  joinedAt: Date;
  status: 'active' | 'disconnected' | 'left';
  score: number;
  progress: any;
}

export interface GameConfiguration {
  maxPlayers: number;
  timeLimit?: number;
  difficulty: 'easy' | 'medium' | 'hard';
  parameters: Record<string, any>;
}

export interface GameAction {
  type: string;
  playerId: string;
  data: any;
  timestamp: Date;
}

export class GameStateManager {
  private snapshots = new Map<string, { version: number; state: GameState }>();
  private readonly SNAPSHOT_INTERVAL = 10; // Take snapshot every 10 events

  constructor(
    private redisManager: RedisManager,
    private eventBroker?: EventBroker
  ) {}

  async createGame(gameConfig: Partial<GameState>): Promise<GameState> {
    const gameId = uuidv4();
    
    const gameState: GameState = {
      id: gameId,
      type: gameConfig.type || 'bias-detection',
      status: 'waiting',
      players: [],
      currentRound: 0,
      totalRounds: gameConfig.totalRounds || 5,
      configuration: gameConfig.configuration || {
        maxPlayers: 4,
        difficulty: 'medium',
        parameters: {}
      },
      state: {},
      version: 1,
      lastUpdated: new Date()
    };

    // Save initial state
    await this.saveGameState(gameId, gameState);

    // Publish domain event
    if (this.eventBroker) {
      await this.eventBroker.publishGameEvent(gameId, 'created', {
        gameType: gameState.type,
        configuration: gameState.configuration
      });
    }

    logger.info(`Game created: ${gameId}`);
    return gameState;
  }

  async getGameState(gameId: string): Promise<GameState | null> {
    try {
      // Try to get from cache first
      const cached = await this.redisManager.get<GameState>(`game:${gameId}`);
      if (cached) {
        return cached;
      }

      // If not cached, rebuild from events if event sourcing is enabled
      if (this.eventBroker) {
        return await this.rebuildGameStateFromEvents(gameId);
      }

      return null;
    } catch (error) {
      logger.error(`Error getting game state for ${gameId}:`, error);
      return null;
    }
  }

  async saveGameState(gameId: string, gameState: GameState): Promise<void> {
    try {
      gameState.lastUpdated = new Date();
      gameState.version++;

      // Save to Redis with TTL
      const ttl = 24 * 60 * 60; // 24 hours
      await this.redisManager.set(`game:${gameId}`, gameState, ttl);

      // Update player indices
      for (const player of gameState.players) {
        await this.redisManager.sadd(`player:${player.id}:games`, gameId);
      }

      // Take snapshot if needed
      if (gameState.version % this.SNAPSHOT_INTERVAL === 0) {
        await this.createSnapshot(gameId, gameState);
      }

    } catch (error) {
      logger.error(`Error saving game state for ${gameId}:`, error);
      throw error;
    }
  }

  async addPlayerToGame(gameId: string, playerId: string, username: string): Promise<{ success: boolean; error?: string; gameState?: GameState }> {
    try {
      const gameState = await this.getGameState(gameId);
      if (!gameState) {
        return { success: false, error: 'Game not found' };
      }

      if (gameState.status === 'completed') {
        return { success: false, error: 'Game is completed' };
      }

      if (gameState.players.length >= gameState.configuration.maxPlayers) {
        return { success: false, error: 'Game is full' };
      }

      // Check if player already in game
      const existingPlayer = gameState.players.find(p => p.id === playerId);
      if (existingPlayer) {
        existingPlayer.status = 'active';
      } else {
        const newPlayer: GamePlayer = {
          id: playerId,
          username,
          joinedAt: new Date(),
          status: 'active',
          score: 0,
          progress: {}
        };
        gameState.players.push(newPlayer);
      }

      // Start game if enough players
      if (gameState.status === 'waiting' && gameState.players.length >= 2) {
        gameState.status = 'active';
        gameState.startTime = new Date();
      }

      await this.saveGameState(gameId, gameState);

      // Publish events
      if (this.eventBroker) {
        await this.eventBroker.publishGameEvent(gameId, 'player.joined', {
          playerId,
          username,
          playerCount: gameState.players.length
        }, playerId);

        if (gameState.status === 'active') {
          await this.eventBroker.publishGameEvent(gameId, 'started', {
            playerCount: gameState.players.length,
            configuration: gameState.configuration
          });
        }
      }

      return { success: true, gameState };

    } catch (error) {
      logger.error(`Error adding player to game ${gameId}:`, error);
      return { success: false, error: 'Internal error' };
    }
  }

  async removePlayerFromGame(gameId: string, playerId: string): Promise<{ success: boolean; gameState?: GameState }> {
    try {
      const gameState = await this.getGameState(gameId);
      if (!gameState) {
        return { success: false };
      }

      const playerIndex = gameState.players.findIndex(p => p.id === playerId);
      if (playerIndex === -1) {
        return { success: true, gameState }; // Player not in game
      }

      // Mark player as left or remove
      if (gameState.status === 'active') {
        gameState.players[playerIndex].status = 'left';
      } else {
        gameState.players.splice(playerIndex, 1);
      }

      // Pause or end game if not enough active players
      const activePlayers = gameState.players.filter(p => p.status === 'active');
      if (activePlayers.length < 2 && gameState.status === 'active') {
        gameState.status = 'paused';
      }

      await this.saveGameState(gameId, gameState);

      // Publish event
      if (this.eventBroker) {
        await this.eventBroker.publishGameEvent(gameId, 'player.left', {
          playerId,
          activePlayerCount: activePlayers.length
        }, playerId);
      }

      return { success: true, gameState };

    } catch (error) {
      logger.error(`Error removing player from game ${gameId}:`, error);
      return { success: false };
    }
  }

  async processGameAction(gameId: string, playerId: string, actionType: string, actionData: any): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const gameState = await this.getGameState(gameId);
      if (!gameState) {
        return { success: false, error: 'Game not found' };
      }

      if (gameState.status !== 'active') {
        return { success: false, error: 'Game not active' };
      }

      const player = gameState.players.find(p => p.id === playerId);
      if (!player || player.status !== 'active') {
        return { success: false, error: 'Player not in game or inactive' };
      }

      // Process action based on game type and action type
      const result = await this.processActionByType(gameState, player, actionType, actionData);

      if (result.success) {
        await this.saveGameState(gameId, gameState);

        // Publish game action event
        if (this.eventBroker) {
          await this.eventBroker.publishGameEvent(gameId, `action.${actionType}`, {
            playerId,
            actionData,
            result: result.data,
            gameState: {
              currentRound: gameState.currentRound,
              status: gameState.status,
              scores: gameState.players.map(p => ({ id: p.id, score: p.score }))
            }
          }, playerId);
        }

        // Check for game completion
        if (this.isGameComplete(gameState)) {
          await this.completeGame(gameState);
        }
      }

      return result;

    } catch (error) {
      logger.error(`Error processing game action ${actionType} for game ${gameId}:`, error);
      return { success: false, error: 'Internal error' };
    }
  }

  private async processActionByType(gameState: GameState, player: GamePlayer, actionType: string, actionData: any): Promise<{ success: boolean; data?: any; error?: string }> {
    switch (gameState.type) {
      case 'bias-detection':
        return await this.processBiasDetectionAction(gameState, player, actionType, actionData);
      case 'alignment-test':
        return await this.processAlignmentTestAction(gameState, player, actionType, actionData);
      case 'context-evaluation':
        return await this.processContextEvaluationAction(gameState, player, actionType, actionData);
      default:
        return { success: false, error: 'Unknown game type' };
    }
  }

  private async processBiasDetectionAction(gameState: GameState, player: GamePlayer, actionType: string, actionData: any): Promise<{ success: boolean; data?: any; error?: string }> {
    switch (actionType) {
      case 'submit_answer':
        const { scenarioId, detectedBiases, confidence } = actionData;
        
        if (!scenarioId || !detectedBiases || confidence === undefined) {
          return { success: false, error: 'Invalid answer data' };
        }

        // Calculate score based on correct bias detection
        const correctBiases = gameState.state.scenarios?.[scenarioId]?.biases || [];
        const score = this.calculateBiasDetectionScore(detectedBiases, correctBiases, confidence);
        
        player.score += score;
        player.progress[scenarioId] = {
          detectedBiases,
          confidence,
          score,
          timestamp: new Date()
        };

        // Check if round is complete
        const allPlayersAnswered = gameState.players
          .filter(p => p.status === 'active')
          .every(p => p.progress[scenarioId]);

        if (allPlayersAnswered) {
          gameState.currentRound++;
        }

        return {
          success: true,
          data: {
            score,
            totalScore: player.score,
            roundComplete: allPlayersAnswered,
            currentRound: gameState.currentRound
          }
        };

      default:
        return { success: false, error: 'Unknown action type' };
    }
  }

  private async processAlignmentTestAction(gameState: GameState, player: GamePlayer, actionType: string, actionData: any): Promise<{ success: boolean; data?: any; error?: string }> {
    switch (actionType) {
      case 'select_response':
        const { questionId, selectedResponse, reasoning } = actionData;
        
        if (!questionId || !selectedResponse) {
          return { success: false, error: 'Invalid response data' };
        }

        // Store player's response
        player.progress[questionId] = {
          selectedResponse,
          reasoning,
          timestamp: new Date()
        };

        // Calculate alignment score if this is the final question
        if (Object.keys(player.progress).length >= gameState.totalRounds) {
          const alignmentScore = this.calculateAlignmentScore(player.progress);
          player.score = alignmentScore;
        }

        return {
          success: true,
          data: {
            progress: Object.keys(player.progress).length,
            totalQuestions: gameState.totalRounds,
            alignmentScore: player.score
          }
        };

      default:
        return { success: false, error: 'Unknown action type' };
    }
  }

  private async processContextEvaluationAction(gameState: GameState, player: GamePlayer, actionType: string, actionData: any): Promise<{ success: boolean; data?: any; error?: string }> {
    switch (actionType) {
      case 'evaluate_context':
        const { contextId, evaluation, factors } = actionData;
        
        if (!contextId || !evaluation) {
          return { success: false, error: 'Invalid evaluation data' };
        }

        const score = this.calculateContextEvaluationScore(evaluation, factors);
        player.score += score;
        player.progress[contextId] = {
          evaluation,
          factors,
          score,
          timestamp: new Date()
        };

        return {
          success: true,
          data: {
            score,
            totalScore: player.score,
            evaluation
          }
        };

      default:
        return { success: false, error: 'Unknown action type' };
    }
  }

  private calculateBiasDetectionScore(detected: string[], correct: string[], confidence: number): number {
    const correctDetections = detected.filter(bias => correct.includes(bias)).length;
    const falsePositives = detected.filter(bias => !correct.includes(bias)).length;
    const missedBiases = correct.filter(bias => !detected.includes(bias)).length;

    const accuracy = correct.length > 0 ? correctDetections / correct.length : 0;
    const precision = detected.length > 0 ? correctDetections / detected.length : 0;
    
    const baseScore = (accuracy + precision) / 2 * 100;
    const confidenceBonus = confidence * 10;
    const penalty = (falsePositives + missedBiases) * 5;

    return Math.max(0, Math.round(baseScore + confidenceBonus - penalty));
  }

  private calculateAlignmentScore(responses: Record<string, any>): number {
    // Implementation depends on specific alignment testing methodology
    // This is a simplified version
    const totalResponses = Object.keys(responses).length;
    const consistencyScore = this.calculateConsistency(responses);
    const humanAlignmentScore = this.calculateHumanAlignment(responses);
    
    return Math.round((consistencyScore + humanAlignmentScore) / 2);
  }

  private calculateContextEvaluationScore(evaluation: any, factors: any[]): number {
    // Score based on comprehensiveness and accuracy of context evaluation
    const completenessScore = factors.length * 10;
    const accuracyScore = evaluation.accuracy || 0;
    
    return Math.round(completenessScore + accuracyScore);
  }

  private calculateConsistency(responses: Record<string, any>): number {
    // Calculate consistency across responses
    return 75; // Placeholder
  }

  private calculateHumanAlignment(responses: Record<string, any>): number {
    // Calculate alignment with human values
    return 80; // Placeholder
  }

  private isGameComplete(gameState: GameState): boolean {
    if (gameState.currentRound >= gameState.totalRounds) {
      return true;
    }

    // Check if all active players have completed all required actions
    const activePlayers = gameState.players.filter(p => p.status === 'active');
    if (activePlayers.length === 0) {
      return true;
    }

    return false;
  }

  private async completeGame(gameState: GameState): Promise<void> {
    gameState.status = 'completed';
    gameState.endTime = new Date();

    // Calculate final rankings
    gameState.players.sort((a, b) => b.score - a.score);

    await this.saveGameState(gameState.id, gameState);

    // Publish game completion event
    if (this.eventBroker) {
      await this.eventBroker.publishGameEvent(gameState.id, 'completed', {
        duration: gameState.endTime.getTime() - (gameState.startTime?.getTime() || 0),
        finalScores: gameState.players.map((p, index) => ({
          playerId: p.id,
          username: p.username,
          score: p.score,
          rank: index + 1
        }))
      });
    }

    logger.info(`Game completed: ${gameState.id}`);
  }

  private async createSnapshot(gameId: string, gameState: GameState): Promise<void> {
    if (this.eventBroker) {
      await this.eventBroker.createSnapshot(gameId, gameState.version, gameState);
    }
    
    this.snapshots.set(gameId, { version: gameState.version, state: { ...gameState } });
    logger.debug(`Snapshot created for game ${gameId} at version ${gameState.version}`);
  }

  private async rebuildGameStateFromEvents(gameId: string): Promise<GameState | null> {
    if (!this.eventBroker) {
      return null;
    }

    try {
      // Get latest snapshot if available
      const snapshot = await this.eventBroker.getSnapshot(gameId);
      let gameState: GameState;
      let fromVersion = 0;

      if (snapshot) {
        gameState = snapshot.state;
        fromVersion = snapshot.version;
      } else {
        // No snapshot, start from beginning
        return null; // Would need to replay all events
      }

      // Get events since snapshot
      const events = await this.eventBroker.replayEvents(gameId, fromVersion);

      // Apply events to rebuild state
      for (const event of events) {
        gameState = this.applyEventToGameState(gameState, event);
      }

      // Cache the rebuilt state
      await this.redisManager.set(`game:${gameId}`, gameState, 3600); // 1 hour cache

      return gameState;

    } catch (error) {
      logger.error(`Error rebuilding game state from events for ${gameId}:`, error);
      return null;
    }
  }

  private applyEventToGameState(gameState: GameState, event: DomainEvent): GameState {
    // Apply domain event to game state
    // This is a simplified implementation
    switch (event.type) {
      case 'game.player.joined':
        // Apply player join logic
        break;
      case 'game.action.submit_answer':
        // Apply answer submission logic
        break;
      // Add more event handlers as needed
    }

    gameState.version = event.metadata.version;
    gameState.lastUpdated = new Date(event.metadata.timestamp);

    return gameState;
  }

  // Cleanup methods
  async cleanupExpiredGames(): Promise<void> {
    try {
      // This would typically be run as a background job
      const expiredGames = await this.redisManager.getMainClient().scan(0, 'MATCH', 'game:*');
      
      for (const gameKey of expiredGames[1]) {
        const gameState = await this.redisManager.get<GameState>(gameKey);
        if (gameState && gameState.lastUpdated < new Date(Date.now() - 24 * 60 * 60 * 1000)) {
          await this.redisManager.del(gameKey);
          logger.info(`Cleaned up expired game: ${gameState.id}`);
        }
      }
    } catch (error) {
      logger.error('Error cleaning up expired games:', error);
    }
  }
}