/**
 * ThinkRank Gacha System
 * Implements addictive gacha-style progression mechanics for AI literacy education
 *
 * RESPONSIBILITIES:
 * - Random reward generation with rarity-based probability
 * - Collection management and progression tracking
 * - Pity timer system for guaranteed drops
 * - Pull cost management and currency systems
 * - Educational content integration with gacha mechanics
 *
 * INTEGRATION POINTS:
 * - GameEngine: Pull request processing
 * - CollectionManager: Item storage and organization
 * - RewardEngine: Experience and progression calculation
 * - SocialService: Achievement and sharing integration
 */

import { EventEmitter } from 'events';
import { CollectionManager } from './CollectionManager';
import { RewardEngine } from './RewardEngine';
import { ProgressionSystem } from './ProgressionSystem';

export enum ItemRarity {
  COMMON = 'common',
  UNCOMMON = 'uncommon',
  RARE = 'rare',
  EPIC = 'epic',
  LEGENDARY = 'legendary'
}

export enum PullType {
  SINGLE = 'single',
  MULTI_10 = 'multi_10',
  GUARANTEED_RARE = 'guaranteed_rare',
  DAILY_FREE = 'daily_free'
}

export interface CollectionItem {
  id: string;
  name: string;
  description: string;
  rarity: ItemRarity;
  category: ItemCategory;
  educationalValue: EducationalMetadata;
  visualAsset: AssetReference;
  unlockRequirements?: UnlockCondition[];
  dropWeight: number;
}

export interface GachaPull {
  id: string;
  playerId: string;
  pullType: PullType;
  cost: PullCost;
  results: CollectionItem[];
  pityCounter: number;
  guaranteedDrop: boolean;
  timestamp: Date;
  streakData?: StreakInfo;
}

export interface PullCost {
  premiumCurrency: number;
  softCurrency: number;
  stamina: number;
  dailyPullsUsed: number;
}

export interface PitySystem {
  counter: number;
  threshold: number;
  guaranteedRarity: ItemRarity;
  resetOnDrop: boolean;
}

export interface DropRates {
  [ItemRarity.COMMON]: number;
  [ItemRarity.UNCOMMON]: number;
  [ItemRarity.RARE]: number;
  [ItemRarity.EPIC]: number;
  [ItemRarity.LEGENDARY]: number;
}

export interface GachaConfiguration {
  baseDropRates: DropRates;
  pityThresholds: Map<ItemRarity, number>;
  dailyFreePulls: number;
  maxDailyPulls: number;
  pullCosts: Map<PullType, PullCost>;
  featuredItems: FeaturedItemRotation[];
}

export class GachaSystem extends EventEmitter {
  private config: GachaConfiguration;
  private collectionManager: CollectionManager;
  private rewardEngine: RewardEngine;
  private progressionSystem: ProgressionSystem;
  private pityTimers: Map<string, PitySystem>;
  private pullHistory: Map<string, GachaPull[]>;
  private itemPool: CollectionItem[];

  constructor(config: GachaConfiguration) {
    super();
    this.config = config;
    this.pityTimers = new Map();
    this.pullHistory = new Map();
    this.itemPool = this.initializeItemPool();

    // Initialize subsystems
    this.collectionManager = new CollectionManager();
    this.rewardEngine = new RewardEngine();
    this.progressionSystem = new ProgressionSystem();
  }

  /**
   * Perform a gacha pull with full reward calculation
   */
  async performPull(playerId: string, pullType: PullType): Promise<GachaResult> {
    try {
      // Validate pull eligibility
      await this.validatePullEligibility(playerId, pullType);

      // Get current pity state
      const pitySystem = this.getOrCreatePitySystem(playerId);

      // Calculate adjusted drop rates based on pity
      const adjustedRates = this.calculateAdjustedDropRates(pitySystem);

      // Perform random drops
      const items = await this.generateRandomDrops(pullType, adjustedRates);

      // Update pity counter
      const updatedPity = this.updatePityCounter(pitySystem, items);

      // Calculate rewards and experience
      const rewards = await this.rewardEngine.calculateRewards(items, pullType);
      const experienceGained = this.calculateExperienceGained(items, pullType);

      // Create pull record
      const pullRecord: GachaPull = {
        id: this.generatePullId(),
        playerId,
        pullType,
        cost: this.config.pullCosts.get(pullType)!,
        results: items,
        pityCounter: updatedPity.counter,
        guaranteedDrop: this.wasGuaranteedDrop(updatedPity, items),
        timestamp: new Date()
      };

      // Update player collection
      await this.collectionManager.updateCollection(playerId, items);

      // Update progression
      await this.progressionSystem.updateProgression(playerId, {
        pullCount: 1,
        itemsObtained: items,
        experienceGained,
        pityCounter: updatedPity.counter
      });

      // Store pull history
      this.addPullToHistory(playerId, pullRecord);

      // Update pity timers
      this.pityTimers.set(playerId, updatedPity);

      // Emit gacha events
      this.emit('gacha:pull_completed', {
        playerId,
        pullRecord,
        rewards,
        newCollection: await this.collectionManager.getCollection(playerId)
      });

      return {
        success: true,
        items,
        rewards,
        experienceGained,
        pityCounter: updatedPity.counter,
        pullRecord
      };

    } catch (error) {
      this.emit('gacha:pull_failed', { playerId, pullType, error });
      throw new GachaError('Failed to perform gacha pull', error);
    }
  }

  /**
   * Generate random drops based on rates and pull type
   */
  private async generateRandomDrops(pullType: PullType, rates: DropRates): Promise<CollectionItem[]> {
    const items: CollectionItem[] = [];
    const pullCount = this.getPullCountForType(pullType);

    for (let i = 0; i < pullCount; i++) {
      const item = await this.selectRandomItem(rates);
      if (item) {
        items.push(item);
      }
    }

    return items;
  }

  /**
   * Select a random item based on weighted probabilities
   */
  private async selectRandomItem(rates: DropRates): Promise<CollectionItem | null> {
    // Create weighted array for selection
    const weightedItems: CollectionItem[] = [];
    const totalWeight = Object.values(rates).reduce((sum, rate) => sum + rate, 0);

    for (const item of this.itemPool) {
      const itemRate = rates[item.rarity] * (item.dropWeight || 1);
      const weight = Math.floor((itemRate / totalWeight) * 1000);

      for (let i = 0; i < weight; i++) {
        weightedItems.push(item);
      }
    }

    if (weightedItems.length === 0) {
      return null;
    }

    // Select random item
    const randomIndex = Math.floor(Math.random() * weightedItems.length);
    return weightedItems[randomIndex];
  }

  /**
   * Calculate adjusted drop rates based on pity system
   */
  private calculateAdjustedDropRates(pitySystem: PitySystem): DropRates {
    const adjustedRates: DropRates = { ...this.config.baseDropRates };

    // Increase rates as pity counter approaches threshold
    if (pitySystem.counter > 0) {
      const pityMultiplier = 1 + (pitySystem.counter / pitySystem.threshold) * 0.5;

      // Apply multiplier to higher rarities
      adjustedRates[ItemRarity.RARE] *= pityMultiplier;
      adjustedRates[ItemRarity.EPIC] *= pityMultiplier * 1.2;
      adjustedRates[ItemRarity.LEGENDARY] *= pityMultiplier * 1.5;

      // Normalize rates to ensure they sum to 100%
      const totalRate = Object.values(adjustedRates).reduce((sum, rate) => sum + rate, 0);
      if (totalRate > 100) {
        const normalizationFactor = 100 / totalRate;
        Object.keys(adjustedRates).forEach(rarity => {
          adjustedRates[rarity as ItemRarity] *= normalizationFactor;
        });
      }
    }

    return adjustedRates;
  }

  /**
   * Update pity counter after pull
   */
  private updatePityCounter(pitySystem: PitySystem, items: CollectionItem[]): PitySystem {
    const highestRarity = this.getHighestRarity(items);
    const shouldReset = pitySystem.resetOnDrop &&
                       this.isRarityAboveThreshold(highestRarity, pitySystem.guaranteedRarity);

    return {
      ...pitySystem,
      counter: shouldReset ? 0 : pitySystem.counter + 1
    };
  }

  /**
   * Check if pity system should trigger guaranteed drop
   */
  private shouldTriggerGuaranteedDrop(pitySystem: PitySystem): boolean {
    return pitySystem.counter >= pitySystem.threshold;
  }

  /**
   * Validate if player is eligible for pull
   */
  private async validatePullEligibility(playerId: string, pullType: PullType): Promise<void> {
    const playerProgression = await this.progressionSystem.getProgression(playerId);
    const pullCost = this.config.pullCosts.get(pullType);

    if (!pullCost) {
      throw new GachaError(`Invalid pull type: ${pullType}`);
    }

    // Check daily pull limits
    if (pullType !== PullType.DAILY_FREE) {
      const todayPulls = await this.getTodayPullCount(playerId);
      if (todayPulls >= this.config.maxDailyPulls) {
        throw new GachaError('Daily pull limit exceeded');
      }
    }

    // Check daily free pulls
    if (pullType === PullType.DAILY_FREE) {
      const todayFreePulls = await this.getTodayFreePullCount(playerId);
      if (todayFreePulls >= this.config.dailyFreePulls) {
        throw new GachaError('Daily free pulls exhausted');
      }
    }

    // Validate currency/stamina requirements
    if (!await this.validatePullCost(playerId, pullCost)) {
      throw new GachaError('Insufficient resources for pull');
    }
  }

  /**
   * Calculate experience gained from pull
   */
  private calculateExperienceGained(items: CollectionItem[], pullType: PullType): number {
    let baseExperience = 0;

    // Base experience per item
    items.forEach(item => {
      baseExperience += this.getExperienceForRarity(item.rarity);
    });

    // Bonus experience for pull type
    const pullTypeMultiplier = this.getPullTypeMultiplier(pullType);
    baseExperience *= pullTypeMultiplier;

    // Bonus for new items
    const newItemCount = items.filter(item =>
      !this.collectionManager.hasItem(playerId, item.id)
    ).length;
    baseExperience += newItemCount * 10;

    return Math.floor(baseExperience);
  }

  /**
   * Get experience value for item rarity
   */
  private getExperienceForRarity(rarity: ItemRarity): number {
    const experienceMap = {
      [ItemRarity.COMMON]: 5,
      [ItemRarity.UNCOMMON]: 10,
      [ItemRarity.RARE]: 25,
      [ItemRarity.EPIC]: 50,
      [ItemRarity.LEGENDARY]: 100
    };

    return experienceMap[rarity] || 5;
  }

  /**
   * Get pull type multiplier for experience
   */
  private getPullTypeMultiplier(pullType: PullType): number {
    const multipliers = {
      [PullType.SINGLE]: 1.0,
      [PullType.MULTI_10]: 1.5,
      [PullType.GUARANTEED_RARE]: 2.0,
      [PullType.DAILY_FREE]: 0.5
    };

    return multipliers[pullType] || 1.0;
  }

  /**
   * Get or create pity system for player
   */
  private getOrCreatePitySystem(playerId: string): PitySystem {
    if (!this.pityTimers.has(playerId)) {
      this.pityTimers.set(playerId, {
        counter: 0,
        threshold: 100,
        guaranteedRarity: ItemRarity.RARE,
        resetOnDrop: true
      });
    }
    return this.pityTimers.get(playerId)!;
  }

  /**
   * Get highest rarity from items
   */
  private getHighestRarity(items: CollectionItem[]): ItemRarity {
    const rarityOrder = [
      ItemRarity.COMMON,
      ItemRarity.UNCOMMON,
      ItemRarity.RARE,
      ItemRarity.EPIC,
      ItemRarity.LEGENDARY
    ];

    return items.reduce((highest, item) => {
      const currentIndex = rarityOrder.indexOf(item.rarity);
      const highestIndex = rarityOrder.indexOf(highest);
      return currentIndex > highestIndex ? item.rarity : highest;
    }, ItemRarity.COMMON);
  }

  /**
   * Check if rarity is above threshold
   */
  private isRarityAboveThreshold(rarity: ItemRarity, threshold: ItemRarity): boolean {
    const rarityOrder = [
      ItemRarity.COMMON,
      ItemRarity.UNCOMMON,
      ItemRarity.RARE,
      ItemRarity.EPIC,
      ItemRarity.LEGENDARY
    ];

    return rarityOrder.indexOf(rarity) >= rarityOrder.indexOf(threshold);
  }

  /**
   * Check if this was a guaranteed drop
   */
  private wasGuaranteedDrop(pitySystem: PitySystem, items: CollectionItem[]): boolean {
    return pitySystem.counter >= pitySystem.threshold &&
           this.getHighestRarity(items) >= pitySystem.guaranteedRarity;
  }

  /**
   * Get pull count for pull type
   */
  private getPullCountForType(pullType: PullType): number {
    const pullCounts = {
      [PullType.SINGLE]: 1,
      [PullType.MULTI_10]: 10,
      [PullType.GUARANTEED_RARE]: 1,
      [PullType.DAILY_FREE]: 1
    };

    return pullCounts[pullType] || 1;
  }

  /**
   * Get today's pull count for player
   */
  private async getTodayPullCount(playerId: string): Promise<number> {
    const today = new Date().toDateString();
    const playerHistory = this.pullHistory.get(playerId) || [];

    return playerHistory.filter(pull =>
      pull.timestamp.toDateString() === today
    ).length;
  }

  /**
   * Get today's free pull count
   */
  private async getTodayFreePullCount(playerId: string): Promise<number> {
    const today = new Date().toDateString();
    const playerHistory = this.pullHistory.get(playerId) || [];

    return playerHistory.filter(pull =>
      pull.timestamp.toDateString() === today &&
      pull.pullType === PullType.DAILY_FREE
    ).length;
  }

  /**
   * Validate pull cost requirements
   */
  private async validatePullCost(playerId: string, cost: PullCost): Promise<boolean> {
    // This would integrate with the player's inventory/currency system
    // For now, return true as placeholder
    return true;
  }

  /**
   * Initialize the item pool
   */
  private initializeItemPool(): CollectionItem[] {
    // This would load from database/configuration
    // For now, return empty array as placeholder
    return [];
  }

  /**
   * Generate unique pull ID
   */
  private generatePullId(): string {
    return `pull_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add pull to history
   */
  private addPullToHistory(playerId: string, pull: GachaPull): void {
    if (!this.pullHistory.has(playerId)) {
      this.pullHistory.set(playerId, []);
    }

    const history = this.pullHistory.get(playerId)!;
    history.push(pull);

    // Keep only last 1000 pulls
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }
  }

  /**
   * Get player's gacha statistics
   */
  async getPlayerStats(playerId: string): Promise<GachaStats> {
    const history = this.pullHistory.get(playerId) || [];
    const pitySystem = this.pityTimers.get(playerId);

    const stats: GachaStats = {
      totalPulls: history.length,
      totalItemsObtained: history.reduce((sum, pull) => sum + pull.results.length, 0),
      pityCounter: pitySystem?.counter || 0,
      rarityStats: this.calculateRarityStats(history),
      favoriteItemCategory: await this.getFavoriteCategory(playerId),
      lastPullDate: history.length > 0 ? history[history.length - 1].timestamp : null
    };

    return stats;
  }

  /**
   * Calculate rarity distribution statistics
   */
  private calculateRarityStats(history: GachaPull[]): Map<ItemRarity, number> {
    const rarityStats = new Map<ItemRarity, number>();

    history.forEach(pull => {
      pull.results.forEach(item => {
        const current = rarityStats.get(item.rarity) || 0;
        rarityStats.set(item.rarity, current + 1);
      });
    });

    return rarityStats;
  }

  /**
   * Get player's favorite item category
   */
  private async getFavoriteCategory(playerId: string): Promise<ItemCategory | null> {
    const collection = await this.collectionManager.getCollection(playerId);
    const categoryCounts = new Map<ItemCategory, number>();

    collection.items.forEach(item => {
      const current = categoryCounts.get(item.category) || 0;
      categoryCounts.set(item.category, current + 1);
    });

    let favoriteCategory: ItemCategory | null = null;
    let maxCount = 0;

    categoryCounts.forEach((count, category) => {
      if (count > maxCount) {
        maxCount = count;
        favoriteCategory = category;
      }
    });

    return favoriteCategory;
  }

  /**
   * Update player after successful pull
   */
  async updatePlayerAfterPull(playerId: string, pullResult: GachaResult): Promise<PlayerState> {
    // This would integrate with the main player state management
    // For now, return placeholder
    return {} as PlayerState;
  }
}

// Supporting interfaces and types
export interface GachaResult {
  success: boolean;
  items: CollectionItem[];
  rewards: any[];
  experienceGained: number;
  pityCounter: number;
  pullRecord: GachaPull;
}

export interface GachaStats {
  totalPulls: number;
  totalItemsObtained: number;
  pityCounter: number;
  rarityStats: Map<ItemRarity, number>;
  favoriteItemCategory: ItemCategory | null;
  lastPullDate: Date | null;
}

export enum ItemCategory {
  BIAS_DETECTION = 'bias_detection',
  RESEARCH_METHODOLOGY = 'research_methodology',
  AI_ETHICS = 'ai_ethics',
  DATA_ANALYSIS = 'data_analysis',
  CRITICAL_THINKING = 'critical_thinking'
}

export interface EducationalMetadata {
  learningObjectives: string[];
  difficulty: number;
  estimatedTimeMinutes: number;
  prerequisites: string[];
  relatedConcepts: string[];
}

export interface AssetReference {
  assetId: string;
  bundleName: string;
  fallbackAsset?: string;
}

export interface UnlockCondition {
  type: 'level' | 'collection' | 'achievement' | 'social';
  requirement: any;
  description: string;
}

export interface FeaturedItemRotation {
  startDate: Date;
  endDate: Date;
  featuredItems: CollectionItem[];
  increasedRates: Map<ItemRarity, number>;
}

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  lastPullDate: Date;
  streakRewards: any[];
}

export class GachaError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = 'GachaError';
  }
}

// Additional supporting classes would be implemented here
export class CollectionManager {
  async updateCollection(playerId: string, items: CollectionItem[]): Promise<void> {
    // Implementation for updating player collection
  }

  async getCollection(playerId: string): Promise<any> {
    // Implementation for getting player collection
    return {};
  }

  hasItem(playerId: string, itemId: string): boolean {
    // Implementation for checking if player has item
    return false;
  }
}

export class RewardEngine {
  async calculateRewards(items: CollectionItem[], pullType: PullType): Promise<any[]> {
    // Implementation for calculating rewards
    return [];
  }
}

export class ProgressionSystem {
  async updateProgression(playerId: string, update: any): Promise<void> {
    // Implementation for updating progression
  }

  async getProgression(playerId: string): Promise<any> {
    // Implementation for getting progression
    return {};
  }
}