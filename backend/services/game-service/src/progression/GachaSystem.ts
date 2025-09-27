/**
 * ThinkRank Advanced Gacha System
 * Probability-based challenge pack distribution with dynamic rarity mechanics
 *
 * RESPONSIBILITIES:
 * - Multi-tier rarity system with dynamic drop rates
 * - Pity system to guarantee rare items after multiple pulls
 * - Seasonal and limited-time challenge packs
 * - Player progression-based pack availability
 * - Mobile-optimized pull animations and feedback
 * - Analytics tracking for pull patterns and engagement
 * - Currency and resource management
 * - Collection completion tracking
 *
 * GACHA MECHANICS:
 * - Tiered rarity system (Common, Rare, Epic, Legendary, Mythic)
 * - Dynamic drop rates based on player level and history
 * - Pity counter system for guaranteed drops
 * - Seasonal rotation of challenge themes
 * - Collection-based progression unlocks
 * - Social sharing of rare pulls
 */

import { EventEmitter } from 'events';
import { PlayerState, Collection, PlayerProgression } from '../core/GameEngine';

export interface GachaConfig {
  rarityTiers: RarityTier[];
  pullCosts: Map<string, number>;
  pitySystem: PitySystemConfig;
  seasonalPacks: SeasonalPack[];
  progressionUnlocks: ProgressionUnlock[];
  analyticsConfig: AnalyticsConfig;
}

export interface RarityTier {
  id: string;
  name: string;
  color: string;
  probability: number;
  baseDropRate: number;
  items: GachaItem[];
  visualEffects: VisualEffect[];
  guaranteedPulls: number; // Pity system threshold
}

export interface GachaItem {
  id: string;
  name: string;
  description: string;
  rarity: string;
  type: ItemType;
  category: ItemCategory;
  challengeIds: string[];
  skills: string[];
  visualAsset: string;
  animation: string;
  soundEffect: string;
  unlockRequirements?: UnlockRequirement[];
  specialEffects?: SpecialEffect[];
}

export enum ItemType {
  CHALLENGE_PACK = 'challenge_pack',
  COSMETIC = 'cosmetic',
  BOOSTER = 'booster',
  CURRENCY = 'currency',
  COLLECTION_ITEM = 'collection_item'
}

export enum ItemCategory {
  AI_BIAS_DETECTION = 'ai_bias_detection',
  RESEARCH_METHODOLOGY = 'research_methodology',
  ETHICAL_AI = 'ethical_ai',
  DATA_LITERACY = 'data_literacy',
  CRITICAL_THINKING = 'critical_thinking',
  MEDIA_LITERACY = 'media_literacy',
  COSMETIC_THEME = 'cosmetic_theme',
  POWER_UP = 'power_up'
}

export interface UnlockRequirement {
  type: UnlockRequirementType;
  value: number;
  description: string;
}

export enum UnlockRequirementType {
  PLAYER_LEVEL = 'player_level',
  CHALLENGES_COMPLETED = 'challenges_completed',
  SKILL_LEVEL = 'skill_level',
  COLLECTION_PERCENTAGE = 'collection_percentage',
  DAYS_PLAYED = 'days_played'
}

export interface SpecialEffect {
  type: SpecialEffectType;
  duration: number;
  magnitude: number;
  description: string;
}

export enum SpecialEffectType {
  EXPERIENCE_BOOST = 'experience_boost',
  ACCURACY_BONUS = 'accuracy_bonus',
  SPEED_BONUS = 'speed_bonus',
  HINT_UNLOCK = 'hint_unlock',
  SKIP_CHALLENGE = 'skip_challenge'
}

export interface PullResult {
  pullId: string;
  playerId: string;
  pullType: PullType;
  items: GachaItem[];
  rarities: string[];
  pityCounters: Map<string, number>;
  specialEffects: SpecialEffect[];
  pullValue: number;
  timestamp: Date;
  isJackpot: boolean;
}

export enum PullType {
  SINGLE = 'single',
  MULTI_10 = 'multi_10',
  PREMIUM = 'premium',
  FREE_DAILY = 'free_daily',
  SEASONAL = 'seasonal',
  PROGRESSION = 'progression'
}

export interface PitySystemConfig {
  enabled: boolean;
  basePityThreshold: number;
  softPityStart: number;
  hardPityThreshold: number;
  pityIncreaseRate: number;
  resetOnRarePull: boolean;
}

export interface SeasonalPack {
  id: string;
  name: string;
  theme: string;
  startDate: Date;
  endDate: Date;
  exclusiveItems: string[];
  specialMechanics: SpecialMechanic[];
  pullCostMultiplier: number;
}

export interface SpecialMechanic {
  type: SpecialMechanicType;
  parameters: Record<string, any>;
  description: string;
}

export enum SpecialMechanicType {
  INCREASED_DROP_RATE = 'increased_drop_rate',
  GUARANTEED_RARE = 'guaranteed_rare',
  BONUS_ITEMS = 'bonus_items',
  EXPERIENCE_MULTIPLIER = 'experience_multiplier'
}

export interface ProgressionUnlock {
  level: number;
  unlocks: string[];
  specialOffers: string[];
  description: string;
}

export interface VisualEffect {
  type: VisualEffectType;
  intensity: number;
  duration: number;
  color: string;
  particleCount: number;
}

export enum VisualEffectType {
  SPARKLES = 'sparkles',
  GLOW = 'glow',
  EXPLOSION = 'explosion',
  RAINBOW = 'rainbow',
  STARBURST = 'starburst'
}

export interface AnalyticsConfig {
  trackPullPatterns: boolean;
  trackPlayerRetention: boolean;
  trackItemPopularity: boolean;
  trackRevenueImpact: boolean;
  dataRetentionDays: number;
}

export interface PullAnimation {
  sequence: AnimationStep[];
  duration: number;
  soundTrack: string;
  screenShake: boolean;
  particleEffects: boolean;
}

export interface AnimationStep {
  delay: number;
  effect: VisualEffect;
  sound?: string;
  text?: string;
}

export interface GachaCollection {
  playerId: string;
  items: Map<string, CollectionItem>;
  completionStats: Map<string, number>;
  favoriteItems: string[];
  lastUpdated: Date;
}

export interface CollectionItem {
  itemId: string;
  obtainedAt: Date;
  pullType: PullType;
  quantity: number;
  isNew: boolean;
  isFavorite: boolean;
  experienceGained: number;
}

export interface PlayerGachaStats {
  playerId: string;
  totalPulls: number;
  totalSpent: number;
  pityCounters: Map<string, number>;
  favoriteRarity: string;
  luckiestPull: PullResult;
  collectionProgress: number;
  lastPullDate: Date;
  streakCount: number;
}

export class GachaSystem extends EventEmitter {
  private config: GachaConfig;
  private rarityTiers: Map<string, RarityTier> = new Map();
  private seasonalPacks: Map<string, SeasonalPack> = new Map();
  private playerCollections: Map<string, GachaCollection> = new Map();
  private playerStats: Map<string, PlayerGachaStats> = new Map();
  private pullHistory: Map<string, PullResult[]> = new Map();
  private performanceMetrics: GachaPerformanceMetrics;
  private random: SecureRandom;

  constructor(config: GachaConfig) {
    super();
    this.config = config;
    this.random = new SecureRandom();
    this.performanceMetrics = new GachaPerformanceMetrics();

    this.initializeRarityTiers();
    this.initializeSeasonalPacks();
  }

  /**
   * Perform a gacha pull with advanced probability mechanics
   */
  async performPull(playerId: string, pullType: PullType): Promise<PullResult> {
    const startTime = Date.now();

    try {
      // Get player state and stats
      const playerStats = await this.getPlayerGachaStats(playerId);
      const playerCollection = await this.getPlayerCollection(playerId);

      // Validate pull eligibility
      await this.validatePullEligibility(playerId, pullType);

      // Calculate dynamic drop rates
      const dynamicRates = await this.calculateDynamicDropRates(playerId, pullType);

      // Perform probability-based item selection
      const selectedItems = await this.performItemSelection(dynamicRates, pullType);

      // Check for pity system triggers
      const pityResults = await this.checkPitySystem(playerId, selectedItems);

      // Apply seasonal pack modifiers if applicable
      const finalItems = await this.applySeasonalModifiers(playerId, selectedItems, pullType);

      // Calculate pull value and experience
      const pullValue = this.calculatePullValue(finalItems);
      const experienceGained = this.calculateExperienceFromPull(finalItems);

      // Create pull result
      const result: PullResult = {
        pullId: this.generatePullId(),
        playerId,
        pullType,
        items: finalItems,
        rarities: finalItems.map(item => item.rarity),
        pityCounters: await this.updatePityCounters(playerId, finalItems),
        specialEffects: this.collectSpecialEffects(finalItems),
        pullValue,
        timestamp: new Date(),
        isJackpot: this.isJackpotPull(finalItems)
      };

      // Update player collection and stats
      await this.updatePlayerCollection(playerId, finalItems, pullType);
      await this.updatePlayerStats(playerId, result);

      // Record pull history
      await this.recordPullHistory(playerId, result);

      // Record performance metrics
      this.performanceMetrics.recordPullCompletion(Date.now() - startTime);

      // Emit pull completed event
      this.emit('gacha:pull_completed', { playerId, result });

      return result;

    } catch (error) {
      this.performanceMetrics.recordError('pull_execution', error);
      throw new GachaSystemError('Failed to perform gacha pull', error);
    }
  }

  /**
   * Get available gacha packs for a player
   */
  async getAvailablePacks(playerId: string): Promise<GachaPack[]> {
    const playerProgression = await this.getPlayerProgression(playerId);
    const availablePacks: GachaPack[] = [];

    // Add standard packs
    for (const [tierId, tier] of this.rarityTiers) {
      if (this.isPackAvailableForPlayer(tier, playerProgression)) {
        availablePacks.push({
          id: tier.id,
          name: tier.name,
          type: 'standard',
          cost: this.getPackCost(tier.id),
          items: tier.items,
          dropRates: this.calculateDisplayDropRates(tier),
          isNew: this.isNewPack(tier.id),
          limitedTime: false
        });
      }
    }

    // Add seasonal packs
    for (const [packId, pack] of this.seasonalPacks) {
      if (this.isSeasonalPackActive(pack) &&
          this.isPackAvailableForPlayer(pack, playerProgression)) {
        availablePacks.push({
          id: pack.id,
          name: pack.name,
          type: 'seasonal',
          cost: this.getSeasonalPackCost(pack),
          items: await this.getSeasonalPackItems(pack),
          dropRates: this.getSeasonalPackDropRates(pack),
          isNew: true,
          limitedTime: true,
          endDate: pack.endDate
        });
      }
    }

    return availablePacks;
  }

  /**
   * Get player's gacha collection and statistics
   */
  async getPlayerCollection(playerId: string): Promise<GachaCollection> {
    if (this.playerCollections.has(playerId)) {
      return this.playerCollections.get(playerId)!;
    }

    // Initialize new collection
    const collection: GachaCollection = {
      playerId,
      items: new Map(),
      completionStats: new Map(),
      favoriteItems: [],
      lastUpdated: new Date()
    };

    this.playerCollections.set(playerId, collection);
    return collection;
  }

  /**
   * Get player's gacha statistics
   */
  async getPlayerGachaStats(playerId: string): Promise<PlayerGachaStats> {
    if (this.playerStats.has(playerId)) {
      return this.playerStats.get(playerId)!;
    }

    // Initialize new stats
    const stats: PlayerGachaStats = {
      playerId,
      totalPulls: 0,
      totalSpent: 0,
      pityCounters: new Map(),
      favoriteRarity: 'common',
      collectionProgress: 0,
      lastPullDate: new Date(),
      streakCount: 0
    };

    this.playerStats.set(playerId, stats);
    return stats;
  }

  /**
   * Perform advanced probability-based item selection
   */
  private async performItemSelection(
    dynamicRates: Map<string, number>,
    pullType: PullType
  ): Promise<GachaItem[]> {
    const selectedItems: GachaItem[] = [];

    // Determine number of items based on pull type
    const itemCount = this.getItemCountForPullType(pullType);

    for (let i = 0; i < itemCount; i++) {
      const item = await this.selectWeightedRandomItem(dynamicRates);
      if (item) {
        selectedItems.push(item);
      }
    }

    return selectedItems;
  }

  /**
   * Select item using weighted random probability
   */
  private async selectWeightedRandomItem(dropRates: Map<string, number>): Promise<GachaItem | null> {
    const totalWeight = Array.from(dropRates.values()).reduce((sum, rate) => sum + rate, 0);

    if (totalWeight === 0) {
      return null;
    }

    // Generate random number between 0 and total weight
    let random = this.random.nextFloat() * totalWeight;
    const tiers = Array.from(this.rarityTiers.values());

    for (const tier of tiers) {
      const tierRate = dropRates.get(tier.id) || tier.baseDropRate;
      random -= tierRate;

      if (random <= 0) {
        // Select random item from this tier
        if (tier.items.length > 0) {
          const randomIndex = Math.floor(this.random.nextFloat() * tier.items.length);
          return tier.items[randomIndex];
        }
        break;
      }
    }

    return null;
  }

  /**
   * Calculate dynamic drop rates based on player history
   */
  private async calculateDynamicDropRates(
    playerId: string,
    pullType: PullType
  ): Promise<Map<string, number>> {
    const playerStats = await this.getPlayerGachaStats(playerId);
    const baseRates = new Map<string, number>();

    // Initialize with base rates
    for (const [tierId, tier] of this.rarityTiers) {
      baseRates.set(tierId, tier.baseDropRate);
    }

    // Apply pity system modifications
    const pityRates = await this.applyPitySystemRates(playerId, baseRates);
    const pityAdjustedRates = new Map([...baseRates, ...pityRates]);

    // Apply pull type modifiers
    const pullTypeRates = this.applyPullTypeModifiers(pityAdjustedRates, pullType);
    const pullTypeAdjustedRates = new Map([...pityAdjustedRates, ...pullTypeRates]);

    // Apply player history-based adjustments
    const historyRates = await this.applyPlayerHistoryRates(playerId, pullTypeAdjustedRates);
    const historyAdjustedRates = new Map([...pullTypeAdjustedRates, ...historyRates]);

    // Normalize rates to ensure they sum to 1.0
    return this.normalizeDropRates(historyAdjustedRates);
  }

  /**
   * Apply pity system rate modifications
   */
  private async applyPitySystemRates(
    playerId: string,
    baseRates: Map<string, number>
  ): Promise<Map<string, number>> {
    if (!this.config.pitySystem.enabled) {
      return new Map();
    }

    const playerStats = await this.getPlayerGachaStats(playerId);
    const pityModifications = new Map<string, number>();

    for (const [tierId, tier] of this.rarityTiers) {
      const pityCount = playerStats.pityCounters.get(tierId) || 0;
      const pityThreshold = tier.guaranteedPulls || this.config.pitySystem.basePityThreshold;

      if (pityCount >= this.config.pitySystem.softPityStart) {
        // Apply soft pity - gradual increase in drop rate
        const pityProgress = Math.min(1, (pityCount - this.config.pitySystem.softPityStart) /
                                    (this.config.pitySystem.hardPityThreshold - this.config.pitySystem.softPityStart));

        const pityBonus = pityProgress * this.config.pitySystem.pityIncreaseRate;
        pityModifications.set(tierId, (baseRates.get(tierId) || 0) + pityBonus);
      }
    }

    return pityModifications;
  }

  /**
   * Apply pull type specific rate modifications
   */
  private applyPullTypeModifiers(
    rates: Map<string, number>,
    pullType: PullType
  ): Map<string, number> {
    const modifiers = new Map<string, number>();

    switch (pullType) {
      case PullType.PREMIUM:
        // Premium pulls have higher rare drop rates
        const rareTier = this.rarityTiers.get('epic') || this.rarityTiers.get('rare');
        if (rareTier) {
          modifiers.set(rareTier.id, (rates.get(rareTier.id) || 0) * 1.5);
        }
        break;

      case PullType.FREE_DAILY:
        // Free pulls have lower rates but guaranteed common item
        for (const [tierId, rate] of rates) {
          if (tierId !== 'common') {
            modifiers.set(tierId, rate * 0.5);
          }
        }
        break;

      case PullType.SEASONAL:
        // Seasonal packs have special rates defined in pack config
        break;
    }

    return modifiers;
  }

  /**
   * Apply player history-based rate adjustments
   */
  private async applyPlayerHistoryRates(
    playerId: string,
    rates: Map<string, number>
  ): Promise<Map<string, number>> {
    const playerStats = await this.getPlayerGachaStats(playerId);
    const playerCollection = await this.getPlayerCollection(playerId);
    const modifications = new Map<string, number>();

    // Adjust rates based on collection completion
    const collectionProgress = this.calculateCollectionProgress(playerCollection);

    if (collectionProgress > 0.8) {
      // Player has most items - increase rare drop rates to help completion
      for (const [tierId, tier] of this.rarityTiers) {
        if (tierId !== 'common') {
          const completionBonus = (1 - collectionProgress) * 0.1;
          modifications.set(tierId, (rates.get(tierId) || 0) + completionBonus);
        }
      }
    }

    // Adjust based on recent pull luck
    const recentLuck = this.calculateRecentPullLuck(playerId);
    if (recentLuck < 0.3) {
      // Player has been unlucky - give slight boost to rare rates
      const luckCompensation = (0.3 - recentLuck) * 0.2;
      for (const [tierId, tier] of this.rarityTiers) {
        if (tierId !== 'common') {
          modifications.set(tierId, (rates.get(tierId) || 0) + luckCompensation);
        }
      }
    }

    return modifications;
  }

  /**
   * Normalize drop rates to sum to 1.0
   */
  private normalizeDropRates(rates: Map<string, number>): Map<string, number> {
    const total = Array.from(rates.values()).reduce((sum, rate) => sum + rate, 0);

    if (total === 0) {
      return rates;
    }

    const normalized = new Map<string, number>();
    for (const [tierId, rate] of rates) {
      normalized.set(tierId, rate / total);
    }

    return normalized;
  }

  /**
   * Check and apply pity system mechanics
   */
  private async checkPitySystem(
    playerId: string,
    selectedItems: GachaItem[]
  ): Promise<PityResult> {
    if (!this.config.pitySystem.enabled) {
      return { triggered: false, guaranteedItems: [] };
    }

    const playerStats = await this.getPlayerGachaStats(playerId);
    const triggeredTiers: string[] = [];
    const guaranteedItems: GachaItem[] = [];

    // Check each tier for pity threshold
    for (const [tierId, tier] of this.rarityTiers) {
      const pityCount = playerStats.pityCounters.get(tierId) || 0;
      const threshold = tier.guaranteedPulls || this.config.pitySystem.basePityThreshold;

      if (pityCount >= threshold) {
        // Pity triggered - guarantee item from this tier
        triggeredTiers.push(tierId);
        const guaranteedItem = this.selectGuaranteedItemFromTier(tier);
        if (guaranteedItem) {
          guaranteedItems.push(guaranteedItem);
        }
      }
    }

    return {
      triggered: triggeredTiers.length > 0,
      triggeredTiers,
      guaranteedItems
    };
  }

  /**
   * Select guaranteed item from tier for pity system
   */
  private selectGuaranteedItemFromTier(tier: RarityTier): GachaItem | null {
    // Select highest value item from tier, or random if equal
    if (tier.items.length === 0) return null;

    // For now, select random item from tier
    const randomIndex = Math.floor(this.random.nextFloat() * tier.items.length);
    return tier.items[randomIndex];
  }

  /**
   * Update pity counters after pull
   */
  private async updatePityCounters(
    playerId: string,
    items: GachaItem[]
  ): Promise<Map<string, number>> {
    if (!this.config.pitySystem.enabled) {
      return new Map();
    }

    const playerStats = await this.getPlayerGachaStats(playerId);
    const updatedCounters = new Map(playerStats.pityCounters);

    // Increment pity counters for all tiers
    for (const [tierId, tier] of this.rarityTiers) {
      const currentCount = updatedCounters.get(tierId) || 0;
      updatedCounters.set(tierId, currentCount + 1);
    }

    // Reset pity counters for tiers that dropped items
    const droppedRarities = [...new Set(items.map(item => item.rarity))];
    for (const rarity of droppedRarities) {
      const tier = Array.from(this.rarityTiers.values())
        .find(t => t.id === rarity || t.name.toLowerCase() === rarity.toLowerCase());

      if (tier && this.config.pitySystem.resetOnRarePull) {
        updatedCounters.set(tier.id, 0);
      }
    }

    playerStats.pityCounters = updatedCounters;
    return updatedCounters;
  }

  /**
   * Update player collection with new items
   */
  private async updatePlayerCollection(
    playerId: string,
    items: GachaItem[],
    pullType: PullType
  ): Promise<void> {
    const collection = await this.getPlayerCollection(playerId);

    for (const item of items) {
      const existingItem = collection.items.get(item.id);

      if (existingItem) {
        // Increment quantity for duplicate items
        existingItem.quantity++;
      } else {
        // Add new item to collection
        collection.items.set(item.id, {
          itemId: item.id,
          obtainedAt: new Date(),
          pullType,
          quantity: 1,
          isNew: true,
          isFavorite: false,
          experienceGained: this.calculateItemExperienceValue(item)
        });
      }
    }

    // Update completion statistics
    await this.updateCompletionStats(collection, items);

    collection.lastUpdated = new Date();
  }

  /**
   * Update player gacha statistics
   */
  private async updatePlayerStats(playerId: string, result: PullResult): Promise<void> {
    const stats = await this.getPlayerGachaStats(playerId);

    stats.totalPulls++;
    stats.totalSpent += this.getPullCost(result.pullType);
    stats.lastPullDate = new Date();

    // Update favorite rarity based on most obtained
    const rarityCounts = new Map<string, number>();
    for (const rarity of result.rarities) {
      rarityCounts.set(rarity, (rarityCounts.get(rarity) || 0) + 1);
    }

    let maxCount = 0;
    for (const [rarity, count] of rarityCounts) {
      if (count > maxCount) {
        maxCount = count;
        stats.favoriteRarity = rarity;
      }
    }

    // Update luckiest pull if this one is better
    if (this.isBetterPull(result, stats.luckiestPull)) {
      stats.luckiestPull = result;
    }

    // Update collection progress
    const collection = await this.getPlayerCollection(playerId);
    stats.collectionProgress = this.calculateCollectionProgress(collection);

    // Update streak
    const daysSinceLastPull = Math.floor(
      (Date.now() - stats.lastPullDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceLastPull <= 1) {
      stats.streakCount++;
    } else {
      stats.streakCount = 1;
    }
  }

  /**
   * Validate if player is eligible for pull
   */
  private async validatePullEligibility(playerId: string, pullType: PullType): Promise<void> {
    const playerStats = await this.getPlayerGachaStats(playerId);

    // Check daily pull limits
    if (pullType === PullType.FREE_DAILY && playerStats.totalPulls > 0) {
      // Check if free daily pull already used today
      const today = new Date().toDateString();
      const lastPullDate = playerStats.lastPullDate.toDateString();

      if (today === lastPullDate) {
        throw new GachaSystemError('Free daily pull already used today');
      }
    }

    // Check currency requirements
    const pullCost = this.getPullCost(pullType);
    // In real implementation, check player's currency balance

    // Check level requirements for certain pull types
    if (pullType === PullType.PREMIUM) {
      // Check if player meets premium pull requirements
    }
  }

  // Helper methods
  private initializeRarityTiers(): void {
    this.config.rarityTiers.forEach(tier => {
      this.rarityTiers.set(tier.id, tier);
    });
  }

  private initializeSeasonalPacks(): void {
    this.config.seasonalPacks.forEach(pack => {
      this.seasonalPacks.set(pack.id, pack);
    });
  }

  private getItemCountForPullType(pullType: PullType): number {
    switch (pullType) {
      case PullType.SINGLE: return 1;
      case PullType.MULTI_10: return 10;
      case PullType.PREMIUM: return 1;
      case PullType.FREE_DAILY: return 1;
      default: return 1;
    }
  }

  private getPullCost(pullType: PullType): number {
    return this.config.pullCosts.get(pullType) || 0;
  }

  private getPackCost(tierId: string): number {
    const tier = this.rarityTiers.get(tierId);
    return tier ? this.getPullCost(PullType.SINGLE) : 0;
  }

  private calculateDisplayDropRates(tier: RarityTier): Map<string, number> {
    const displayRates = new Map<string, number>();
    displayRates.set(tier.id, tier.baseDropRate * 100); // Convert to percentage
    return displayRates;
  }

  private isPackAvailableForPlayer(pack: any, progression: PlayerProgression): boolean {
    // Check if player meets unlock requirements
    const requiredLevel = this.getPackRequiredLevel(pack);
    return progression.level >= requiredLevel;
  }

  private getPackRequiredLevel(pack: any): number {
    // Default level requirement - can be customized per pack
    return 1;
  }

  private isSeasonalPackActive(pack: SeasonalPack): boolean {
    const now = new Date();
    return now >= pack.startDate && now <= pack.endDate;
  }

  private calculateCollectionProgress(collection: GachaCollection): number {
    const totalItems = Array.from(this.rarityTiers.values())
      .reduce((total, tier) => total + tier.items.length, 0);

    if (totalItems === 0) return 0;

    const uniqueItems = collection.items.size;
    return uniqueItems / totalItems;
  }

  private calculateRecentPullLuck(playerId: string): number {
    // Calculate luck score based on recent 10 pulls
    const history = this.pullHistory.get(playerId) || [];
    const recentPulls = history.slice(-10);

    if (recentPulls.length === 0) return 0.5;

    const totalValue = recentPulls.reduce((sum, pull) => sum + pull.pullValue, 0);
    const averageValue = totalValue / recentPulls.length;

    // Normalize to 0-1 scale (assuming max pull value is 1000)
    return Math.min(1, averageValue / 1000);
  }

  private calculatePullValue(items: GachaItem[]): number {
    return items.reduce((total, item) => total + this.calculateItemValue(item), 0);
  }

  private calculateItemValue(item: GachaItem): number {
    const rarityMultiplier = this.getRarityMultiplier(item.rarity);
    const typeMultiplier = this.getTypeMultiplier(item.type);
    const baseValue = 100; // Base value for all items

    return baseValue * rarityMultiplier * typeMultiplier;
  }

  private getRarityMultiplier(rarity: string): number {
    const multipliers: Record<string, number> = {
      'common': 1,
      'rare': 2,
      'epic': 5,
      'legendary': 10,
      'mythic': 25
    };

    return multipliers[rarity.toLowerCase()] || 1;
  }

  private getTypeMultiplier(type: ItemType): number {
    const multipliers: Record<ItemType, number> = {
      [ItemType.CHALLENGE_PACK]: 1.5,
      [ItemType.COSMETIC]: 1.0,
      [ItemType.BOOSTER]: 2.0,
      [ItemType.CURRENCY]: 1.0,
      [ItemType.COLLECTION_ITEM]: 1.2
    };

    return multipliers[type] || 1.0;
  }

  private calculateExperienceFromPull(items: GachaItem[]): number {
    return items.reduce((total, item) => total + this.calculateItemExperienceValue(item), 0);
  }

  private calculateItemExperienceValue(item: GachaItem): number {
    // Base experience from item rarity
    const baseExp = this.getRarityMultiplier(item.rarity) * 10;

    // Bonus experience for challenge packs
    if (item.type === ItemType.CHALLENGE_PACK) {
      return baseExp * 2;
    }

    return baseExp;
  }

  private collectSpecialEffects(items: GachaItem[]): SpecialEffect[] {
    const effects: SpecialEffect[] = [];

    for (const item of items) {
      if (item.specialEffects) {
        effects.push(...item.specialEffects);
      }
    }

    return effects;
  }

  private isJackpotPull(items: GachaItem[]): boolean {
    // Jackpot if contains legendary or mythic items
    return items.some(item =>
      item.rarity.toLowerCase() === 'legendary' ||
      item.rarity.toLowerCase() === 'mythic'
    );
  }

  private isBetterPull(current: PullResult, best: PullResult): boolean {
    // Compare pull quality
    return current.pullValue > best.pullValue ||
           (current.pullValue === best.pullValue && current.items.length > best.items.length);
  }

  private updateCompletionStats(collection: GachaCollection, newItems: GachaItem[]): void {
    for (const item of newItems) {
      const category = item.category;
      const currentCount = collection.completionStats.get(category) || 0;

      // Count unique items in category
      const categoryItems = Array.from(collection.items.values())
        .filter(collectionItem => {
          const itemData = this.findItemById(collectionItem.itemId);
          return itemData?.category === category;
        });

      collection.completionStats.set(category, categoryItems.length);
    }
  }

  private findItemById(itemId: string): GachaItem | null {
    for (const tier of this.rarityTiers.values()) {
      const item = tier.items.find(i => i.id === itemId);
      if (item) return item;
    }
    return null;
  }

  private generatePullId(): string {
    return `pull_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async recordPullHistory(playerId: string, result: PullResult): Promise<void> {
    if (!this.pullHistory.has(playerId)) {
      this.pullHistory.set(playerId, []);
    }

    const history = this.pullHistory.get(playerId)!;
    history.push(result);

    // Keep only last 100 pulls
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
  }

  private async getPlayerProgression(playerId: string): Promise<PlayerProgression> {
    // In real implementation, get from player service
    return {
      level: 1,
      experience: 0,
      challengesCompleted: 0,
      accuracySum: 0,
      averageAccuracy: 0,
      referralCount: 0
    };
  }

  // Additional helper methods would be implemented here
  private isNewPack(packId: string): boolean {
    // Check if pack was recently added
    return false; // Simplified for now
  }

  private getSeasonalPackCost(pack: SeasonalPack): number {
    const baseCost = this.getPullCost(PullType.SINGLE);
    return Math.round(baseCost * pack.pullCostMultiplier);
  }

  private async getSeasonalPackItems(pack: SeasonalPack): Promise<GachaItem[]> {
    // Get items specific to seasonal pack
    return []; // Simplified for now
  }

  private getSeasonalPackDropRates(pack: SeasonalPack): Map<string, number> {
    // Get modified drop rates for seasonal pack
    return new Map(); // Simplified for now
  }

  private async applySeasonalModifiers(
    playerId: string,
    items: GachaItem[],
    pullType: PullType
  ): Promise<GachaItem[]> {
    // Apply seasonal pack modifications
    return items; // Simplified for now
  }

  /**
   * Get gacha system performance metrics
   */
  getPerformanceMetrics(): GachaPerformanceMetrics {
    return this.performanceMetrics;
  }

  /**
   * Get gacha analytics data
   */
  async getAnalyticsData(playerId?: string): Promise<GachaAnalytics> {
    // Generate analytics based on pull patterns and engagement
    return {
      totalPulls: this.performanceMetrics.getTotalPulls(),
      averagePullValue: this.performanceMetrics.getAveragePullValue(),
      popularRarities: this.getPopularRarities(),
      seasonalEngagement: this.getSeasonalEngagement(),
      playerRetention: this.getPlayerRetentionMetrics()
    };
  }

  private getPopularRarities(): Map<string, number> {
    // Analyze which rarities are most popular
    return new Map(); // Simplified for now
  }

  private getSeasonalEngagement(): Map<string, number> {
    // Analyze seasonal pack engagement
    return new Map(); // Simplified for now
  }

  private getPlayerRetentionMetrics(): any {
    // Analyze player retention patterns
    return {}; // Simplified for now
  }
}

// Supporting interfaces and classes
export interface GachaPack {
  id: string;
  name: string;
  type: string;
  cost: number;
  items: GachaItem[];
  dropRates: Map<string, number>;
  isNew: boolean;
  limitedTime: boolean;
  endDate?: Date;
}

export interface PityResult {
  triggered: boolean;
  triggeredTiers: string[];
  guaranteedItems: GachaItem[];
}

export interface GachaAnalytics {
  totalPulls: number;
  averagePullValue: number;
  popularRarities: Map<string, number>;
  seasonalEngagement: Map<string, number>;
  playerRetention: any;
}

export class GachaSystemError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = 'GachaSystemError';
  }
}

export class GachaPerformanceMetrics {
  private metrics: Map<string, number[]> = new Map();

  recordPullCompletion(duration: number): void {
    this.recordMetric('pull_completion_time', duration);
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

  getTotalPulls(): number {
    return (this.metrics.get('pull_completion_time') || []).length;
  }

  getAveragePullValue(): number {
    // Would calculate based on recorded pull values
    return 0; // Simplified for now
  }

  getErrorCount(type?: string): number {
    const key = type ? `error:${type}` : 'error';
    return (this.metrics.get(key) || []).reduce((sum, val) => sum + val, 0);
  }
}

// Secure random number generator for fair gacha mechanics
export class SecureRandom {
  private seed: number;

  constructor(seed?: number) {
    this.seed = seed || Date.now();
  }

  nextFloat(): number {
    // Simple LCG implementation - in production, use cryptographically secure random
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.nextFloat() * (max - min + 1)) + min;
  }
}

// Default configuration
export const DEFAULT_GACHA_CONFIG: GachaConfig = {
  rarityTiers: [
    {
      id: 'common',
      name: 'Common',
      color: '#9CA3AF',
      probability: 0.6,
      baseDropRate: 0.6,
      items: [], // Would be populated with actual items
      visualEffects: [
        {
          type: VisualEffectType.SPARKLES,
          intensity: 0.3,
          duration: 1000,
          color: '#9CA3AF',
          particleCount: 5
        }
      ],
      guaranteedPulls: 0
    },
    {
      id: 'rare',
      name: 'Rare',
      color: '#3B82F6',
      probability: 0.25,
      baseDropRate: 0.25,
      items: [],
      visualEffects: [
        {
          type: VisualEffectType.GLOW,
          intensity: 0.6,
          duration: 1500,
          color: '#3B82F6',
          particleCount: 10
        }
      ],
      guaranteedPulls: 20
    },
    {
      id: 'epic',
      name: 'Epic',
      color: '#8B5CF6',
      probability: 0.12,
      baseDropRate: 0.12,
      items: [],
      visualEffects: [
        {
          type: VisualEffectType.EXPLOSION,
          intensity: 0.8,
          duration: 2000,
          color: '#8B5CF6',
          particleCount: 15
        }
      ],
      guaranteedPulls: 50
    },
    {
      id: 'legendary',
      name: 'Legendary',
      color: '#F59E0B',
      probability: 0.03,
      baseDropRate: 0.03,
      items: [],
      visualEffects: [
        {
          type: VisualEffectType.STARBURST,
          intensity: 1.0,
          duration: 3000,
          color: '#F59E0B',
          particleCount: 25
        }
      ],
      guaranteedPulls: 100
    }
  ],
  pullCosts: new Map([
    [PullType.SINGLE, 100],
    [PullType.MULTI_10, 900],
    [PullType.PREMIUM, 200],
    [PullType.FREE_DAILY, 0]
  ]),
  pitySystem: {
    enabled: true,
    basePityThreshold: 100,
    softPityStart: 75,
    hardPityThreshold: 100,
    pityIncreaseRate: 0.02,
    resetOnRarePull: true
  },
  seasonalPacks: [], // Would be populated with seasonal content
  progressionUnlocks: [], // Would be populated with level-based unlocks
  analyticsConfig: {
    trackPullPatterns: true,
    trackPlayerRetention: true,
    trackItemPopularity: true,
    trackRevenueImpact: true,
    dataRetentionDays: 90
  }
};