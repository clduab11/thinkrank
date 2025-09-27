# Phase 4: Collection and Gacha System - Pseudocode Design

## MODULE GachaManager
// Manages gacha pulls, item drops, and collection mechanics
// TEST: Generate random rewards following correct probability distributions
// TEST: Enforce daily pull limits and cost requirements

FUNCTION PerformGachaPull(playerId, pullType, paymentMethod)
  // Perform a gacha pull with specified type and payment
  INPUT: playerId - Player performing the pull
  INPUT: pullType - Type of pull (single, multi, guaranteed)
  INPUT: paymentMethod - Currency or method of payment
  OUTPUT: PullResult with items obtained and updated player state

  VALIDATE playerId IS VALID
  VALIDATE pullType IS SUPPORTED
  VALIDATE paymentMethod IS AUTHORIZED

  // Check pull eligibility
  isEligible = CHECK_PULL_ELIGIBILITY(playerId, pullType)
  IF NOT isEligible
    RETURN ERROR("Pull not allowed: insufficient funds or daily limit reached")
  END IF

  // Process payment
  paymentResult = PROCESS_GACHA_PAYMENT(playerId, pullType, paymentMethod)
  IF NOT paymentResult.success
    RETURN ERROR("Payment failed: " + paymentResult.reason)
  END IF

  // Generate random rewards based on drop rates
  rewards = GENERATE_GACHA_REWARDS(pullType, playerId)

  // Apply pity system if applicable
  pityRewards = APPLY_PITY_SYSTEM(playerId, pullType, rewards)
  IF pityRewards IS NOT EMPTY
    rewards = MERGE_REWARDS(rewards, pityRewards)
  END IF

  // Update player collection
  updatedCollection = UPDATE_PLAYER_COLLECTION(playerId, rewards)

  // Record pull for analytics
  RECORD_GACHA_PULL(playerId, pullType, rewards, paymentResult)

  RETURN {
    pullId: GENERATE_PULL_ID(),
    playerId: playerId,
    pullType: pullType,
    rewards: rewards,
    pityTriggered: pityRewards IS NOT EMPTY,
    updatedCollection: updatedCollection,
    pulledAt: GET_CURRENT_TIMESTAMP()
  }
  // TEST: Pull results follow configured drop rate distributions
  // TEST: Payment processing handles all supported methods
  // TEST: Pity system triggers at correct thresholds

FUNCTION CheckPullEligibility(playerId, pullType)
  // Verify player can perform the requested gacha pull
  INPUT: playerId - Player to check
  INPUT: pullType - Type of pull being requested
  OUTPUT: EligibilityResult with allowed status and reason

  VALIDATE playerId IS VALID
  VALIDATE pullType IS SUPPORTED

  // Check currency requirements
  requiredCost = GET_PULL_COST(pullType)
  playerBalance = GET_PLAYER_CURRENCY_BALANCE(playerId, requiredCost.currency)

  IF playerBalance < requiredCost.amount
    RETURN ELIGIBILITY_DENIED("Insufficient currency")
  END IF

  // Check daily pull limits
  dailyPulls = GET_PLAYER_DAILY_PULLS(playerId, pullType)
  dailyLimit = GET_DAILY_PULL_LIMIT(pullType)

  IF dailyPulls >= dailyLimit
    RETURN ELIGIBILITY_DENIED("Daily limit reached")
  END IF

  RETURN ELIGIBILITY_APPROVED()
  // TEST: Currency requirements are validated correctly
  // TEST: Daily limits are enforced per pull type

FUNCTION GenerateGachaRewards(pullType, playerId)
  // Generate random rewards based on pull type and player context
  INPUT: pullType - Type of pull determining reward pool
  INPUT: playerId - Player context for personalized rewards
  OUTPUT: RewardList with items and their rarities

  VALIDATE pullType IS SUPPORTED
  VALIDATE playerId IS VALID

  // Get reward pool for pull type
  rewardPool = GET_REWARD_POOL(pullType)

  // Get drop rates configuration
  dropRates = GET_DROP_RATES(pullType)

  // Generate random items based on rates
  rewards = []
  itemCount = GET_ITEM_COUNT_FOR_PULL_TYPE(pullType)

  FOR i FROM 1 TO itemCount
    randomValue = GENERATE_SECURE_RANDOM()
    item = SELECT_ITEM_FROM_POOL(rewardPool, dropRates, randomValue)
    rewards.ADD(item)
  END FOR

  // Apply player-specific modifications
  personalizedRewards = APPLY_PLAYER_MODIFICATIONS(rewards, playerId)

  RETURN {
    items: personalizedRewards,
    totalValue: CALCULATE_TOTAL_REWARD_VALUE(personalizedRewards),
    rarityDistribution: CALCULATE_RARITY_DISTRIBUTION(personalizedRewards),
    generatedAt: GET_CURRENT_TIMESTAMP()
  }
  // TEST: Random generation follows probability distributions
  // TEST: Secure random number generator prevents prediction

## MODULE CollectionManager
// Manages player item collections and inventory operations
// TEST: Collection updates maintain accurate item counts
// TEST: Collection statistics calculate properly

FUNCTION UpdatePlayerCollection(playerId, newItems)
  // Update player collection with newly acquired items
  INPUT: playerId - Player whose collection to update
  INPUT: newItems - Newly acquired items to add
  OUTPUT: UpdatedCollection with new state and statistics

  VALIDATE playerId IS VALID
  VALIDATE newItems IS NOT_EMPTY

  // Get current collection state
  currentCollection = GET_PLAYER_COLLECTION(playerId)
  IF currentCollection IS NULL
    currentCollection = CREATE_NEW_COLLECTION(playerId)
  END IF

  // Process each new item
  FOR EACH item IN newItems
    // Check if item is stackable
    existingItem = FIND_EXISTING_ITEM(currentCollection, item)

    IF existingItem IS NOT NULL AND item.isStackable
      // Update existing stack
      updatedItem = UPDATE_ITEM_STACK(existingItem, item.quantity)
      UPDATE_COLLECTION_ITEM(currentCollection, updatedItem)
    ELSE
      // Add new item
      item.id = GENERATE_ITEM_INSTANCE_ID()
      item.acquiredAt = GET_CURRENT_TIMESTAMP()
      ADD_ITEM_TO_COLLECTION(currentCollection, item)
    END IF
  END FOR

  // Update collection metadata
  currentCollection.totalItems += newItems.length
  currentCollection.lastUpdated = GET_CURRENT_TIMESTAMP()
  currentCollection.completionPercentage = CALCULATE_COMPLETION_PERCENTAGE(currentCollection)

  // Store updated collection
  STORE_PLAYER_COLLECTION(playerId, currentCollection)

  RETURN currentCollection
  // TEST: New items are added correctly to collection
  // TEST: Stackable items update existing stacks
  // TEST: Collection metadata updates accurately

FUNCTION CalculateCollectionProgress(playerId)
  // Calculate comprehensive collection progress and statistics
  INPUT: playerId - Player whose collection to analyze
  OUTPUT: CollectionProgress with detailed metrics and insights

  VALIDATE playerId IS VALID

  // Get collection data
  collection = GET_PLAYER_COLLECTION(playerId)
  IF collection IS NULL
    RETURN EMPTY_COLLECTION_PROGRESS()
  END IF

  // Calculate basic metrics
  totalItems = collection.items.size
  uniqueItems = COUNT_UNIQUE_ITEMS(collection)
  completionPercentage = CALCULATE_COMPLETION_PERCENTAGE(collection)

  // Analyze by rarity
  rarityDistribution = ANALYZE_RARITY_DISTRIBUTION(collection)
  averageRarity = CALCULATE_AVERAGE_RARITY(rarityDistribution)

  // Analyze by category
  categoryProgress = ANALYZE_CATEGORY_PROGRESS(collection)
  completedCategories = COUNT_COMPLETED_CATEGORIES(categoryProgress)

  // Calculate collection value
  totalValue = CALCULATE_COLLECTION_VALUE(collection)

  RETURN {
    playerId: playerId,
    calculatedAt: GET_CURRENT_TIMESTAMP(),
    basicMetrics: {
      totalItems: totalItems,
      uniqueItems: uniqueItems,
      completionPercentage: completionPercentage,
      averageRarity: averageRarity
    },
    categoryProgress: categoryProgress,
    completedCategories: completedCategories,
    valueMetrics: {
      totalValue: totalValue,
      topValueItems: GET_TOP_VALUE_ITEMS(collection, 5)
    },
    recentAcquisitions: GET_RECENT_ACQUISITIONS(collection, 10)
  }
  // TEST: Collection metrics calculate accurately
  // TEST: Rarity distribution analysis is correct
  // TEST: Value calculations use correct item valuations

## MODULE PitySystem
// Implements pity mechanics to guarantee rare items after N pulls
// TEST: Pity counters increment correctly with each pull
// TEST: Pity rewards trigger at exact thresholds

FUNCTION ApplyPitySystem(playerId, pullType, generatedRewards)
  // Apply pity system logic to potentially upgrade rewards
  INPUT: playerId - Player for pity tracking
  INPUT: pullType - Pull type for pity configuration
  INPUT: generatedRewards - Originally generated rewards
  OUTPUT: PotentiallyModifiedRewards with pity upgrades

  VALIDATE playerId IS VALID
  VALIDATE pullType IS SUPPORTED
  VALIDATE generatedRewards IS NOT_EMPTY

  // Get pity configuration
  pityConfig = GET_PITY_CONFIGURATION(pullType)
  IF NOT pityConfig.enabled
    RETURN EMPTY_PITY_RESULT()
  END IF

  // Get current pity state
  pityState = GET_PLAYER_PITY_STATE(playerId, pullType)
  IF pityState IS NULL
    pityState = CREATE_NEW_PITY_STATE(playerId, pullType)
  END IF

  // Update pity counters
  updatedPityState = UPDATE_PITY_COUNTERS(pityState, generatedRewards)

  // Check if pity threshold reached
  pityTriggered = CHECK_PITY_THRESHOLD(updatedPityState, pityConfig)

  IF pityTriggered
    // Generate pity reward
    pityReward = GENERATE_PITY_REWARD(pullType, updatedPityState)

    // Reset pity counter
    updatedPityState = RESET_PITY_COUNTER(updatedPityState)

    // Replace or add pity reward
    upgradedRewards = UPGRADE_REWARDS_WITH_PITY(generatedRewards, pityReward)

    // Record pity activation
    RECORD_PITY_ACTIVATION(playerId, pullType, pityReward)

    RETURN {
      pityTriggered: true,
      originalRewards: generatedRewards,
      pityReward: pityReward,
      upgradedRewards: upgradedRewards,
      pityState: updatedPityState
    }
  END IF

  // Store updated pity state
  STORE_PITY_STATE(playerId, updatedPityState)

  RETURN {
    pityTriggered: false,
    originalRewards: generatedRewards,
    upgradedRewards: generatedRewards,
    pityState: updatedPityState
  }
  // TEST: Pity counters increment with each non-guaranteed pull
  // TEST: Pity rewards trigger exactly at threshold
  // TEST: Pity state persists correctly between sessions

FUNCTION UpdatePityCounters(pityState, rewards)
  // Update pity counters based on pull results
  INPUT: pityState - Current pity tracking state
  INPUT: rewards - Rewards obtained from pull
  OUTPUT: UpdatedPityState with new counter values

  VALIDATE pityState IS VALID
  VALIDATE rewards IS NOT_EMPTY

  // Check if any rewards are pity-eligible
  pityEligibleRewards = FILTER_PITY_ELIGIBLE_REWARDS(rewards)

  IF pityEligibleRewards IS NOT EMPTY
    // Check if high-rarity reward obtained
    hasHighRarity = CHECK_FOR_HIGH_RARITY(pityEligibleRewards)

    IF hasHighRarity
      // Reset pity counter on successful rare pull
      pityState.currentCount = 0
      pityState.lastReset = GET_CURRENT_TIMESTAMP()
    ELSE
      // Increment pity counter
      pityState.currentCount += 1
      pityState.lastIncrement = GET_CURRENT_TIMESTAMP()
    END IF
  END IF

  // Update pity statistics
  pityState.totalPulls += 1
  pityState.lastUpdated = GET_CURRENT_TIMESTAMP()

  RETURN pityState
  // TEST: Pity counter resets on high-rarity reward
  // TEST: Pity counter increments on non-qualifying pulls
  // TEST: Pity statistics track accurately

// PERFORMANCE REQUIREMENTS
// - Gacha pull processing: <500ms per pull
// - Collection updates: <100ms per update
// - Pity calculations: <50ms per check
// - Collection statistics: <300ms per calculation

// RELIABILITY REQUIREMENTS
// - Pull results must be cryptographically secure
// - Collection state must be consistent across operations
// - Pity counters must be accurate and persistent
// - Item stacking must handle race conditions safely

// SCALABILITY REQUIREMENTS
// - Support 1000 concurrent gacha pulls
// - Handle 5000 collection updates per minute
// - Process 10000 pity calculations per minute
// - Scale storage for millions of collection items