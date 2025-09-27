/**
 * ThinkRank Advanced Scoring System
 * Multi-dimensional evaluation with confidence calibration for AI literacy challenges
 *
 * RESPONSIBILITIES:
 * - Multi-dimensional scoring (accuracy, speed, confidence, reasoning)
 * - Confidence calibration analysis and improvement tracking
 * - Dynamic scoring weights based on challenge type and player history
 * - Performance benchmarking and skill assessment
 * - Real-time score calculation and feedback generation
 * - Mobile-optimized scoring for responsive performance
 *
 * SCORING DIMENSIONS:
 * - Accuracy: Correctness of the answer
 * - Speed: Response time efficiency
 * - Confidence: Calibration between stated and actual confidence
 * - Reasoning: Quality of explanation and evidence provided
 */

import { EventEmitter } from 'events';

export interface ScoringConfig {
  defaultWeights: ScoringWeights;
  confidenceCalibrationEnabled: boolean;
  adaptiveWeightingEnabled: boolean;
  performanceBenchmarks: PerformanceBenchmarks;
  timeDecayFactors: TimeDecayFactors;
  mobileOptimizations: MobileScoringOptimizations;
}

export interface ScoringWeights {
  accuracy: number;
  speed: number;
  confidence: number;
  reasoning: number;
}

export interface ChallengeSubmission {
  challengeId: string;
  playerId: string;
  answer: ChallengeAnswer;
  confidence: number;
  responseTime: number;
  submittedAt: Date;
  metadata?: SubmissionMetadata;
}

export interface ChallengeAnswer {
  selectedOptions: string[];
  reasoning?: string;
  confidenceLevel: number;
  evidence?: string[];
  sources?: string[];
}

export interface SubmissionMetadata {
  deviceType: string;
  networkLatency: number;
  retryCount: number;
  timeSpentThinking: number;
  keystrokePatterns?: KeystrokePattern[];
}

export interface KeystrokePattern {
  timestamp: number;
  key: string;
  action: 'press' | 'release';
  timeFromStart: number;
}

export interface ChallengeContext {
  challengeId: string;
  type: ChallengeType;
  difficulty: Difficulty;
  correctAnswer: string | string[];
  timeLimit?: number;
  complexity: number;
  skills: string[];
}

export interface ChallengeScore {
  overall: number;
  accuracy: number;
  speed: number;
  confidence: number;
  reasoning: number;
  breakdown: DetailedScoreBreakdown;
  confidenceCalibration: ConfidenceCalibrationResult;
  performanceInsights: PerformanceInsights;
  skillAssessment: SkillAssessment;
}

export interface DetailedScoreBreakdown {
  accuracyScore: number;
  accuracyWeight: number;
  speedScore: number;
  speedWeight: number;
  confidenceScore: number;
  confidenceWeight: number;
  reasoningScore: number;
  reasoningWeight: number;
  penalties: ScorePenalty[];
  bonuses: ScoreBonus[];
}

export interface ScorePenalty {
  type: PenaltyType;
  amount: number;
  reason: string;
}

export interface ScoreBonus {
  type: BonusType;
  amount: number;
  reason: string;
}

export enum PenaltyType {
  INCORRECT_ANSWER = 'incorrect_answer',
  TIME_EXCEEDED = 'time_exceeded',
  LOW_CONFIDENCE_CALIBRATION = 'low_confidence_calibration',
  POOR_REASONING = 'poor_reasoning',
  RETRY_PENALTY = 'retry_penalty'
}

export enum BonusType {
  FAST_RESPONSE = 'fast_response',
  HIGH_CONFIDENCE_CALIBRATION = 'high_confidence_calibration',
  EXCELLENT_REASONING = 'excellent_reasoning',
  PERFECT_ACCURACY = 'perfect_accuracy',
  BONUS_OBJECTIVE = 'bonus_objective'
}

export interface ConfidenceCalibrationResult {
  statedConfidence: number;
  actualConfidence: number;
  calibrationScore: number;
  calibrationAccuracy: number;
  overconfidencePenalty: number;
  underconfidencePenalty: number;
  recommendations: string[];
}

export interface PerformanceInsights {
  strengths: string[];
  weaknesses: string[];
  improvementAreas: string[];
  learningProgression: LearningProgression;
  nextSkillTargets: string[];
  estimatedTimeToNextLevel: number;
}

export interface LearningProgression {
  currentLevel: number;
  progressToNextLevel: number;
  experienceGained: number;
  skillGaps: string[];
  masteredSkills: string[];
}

export interface SkillAssessment {
  skillScores: Map<string, number>;
  skillProgression: Map<string, number>;
  skillRecommendations: Map<string, string[]>;
  competencyLevels: Map<string, CompetencyLevel>;
}

export enum CompetencyLevel {
  NOVICE = 'novice',
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert'
}

export interface PerformanceBenchmarks {
  averageResponseTime: number;
  accuracyThresholds: Map<Difficulty, number>;
  speedThresholds: Map<Difficulty, number>;
  reasoningQualityStandards: Map<ChallengeType, number>;
}

export interface TimeDecayFactors {
  speedDecayRate: number;
  accuracyDecayRate: number;
  reasoningDecayRate: number;
  confidenceDecayRate: number;
}

export interface MobileScoringOptimizations {
  networkLatencyCompensation: number;
  deviceTypeAdjustments: Map<string, number>;
  batteryOptimizationMode: boolean;
  reducedPrecisionMode: boolean;
}

export enum ChallengeType {
  BIAS_DETECTION = 'bias_detection',
  RESEARCH_WORKFLOW = 'research_workflow',
  CONTEXT_EVALUATION = 'context_evaluation',
  ETHICAL_SCENARIO = 'ethical_scenario',
  RESEARCH_INVESTIGATION = 'research_investigation',
  CROSS_MODAL_CHALLENGE = 'cross_modal'
}

export enum Difficulty {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert'
}

export class ScoringSystem extends EventEmitter {
  private config: ScoringConfig;
  private performanceBenchmarks: PerformanceBenchmarks;
  private timeDecayFactors: TimeDecayFactors;
  private mobileOptimizations: MobileScoringOptimizations;
  private playerHistory: Map<string, PlayerScoringHistory> = new Map();
  private scoringCache: Map<string, ChallengeScore> = new Map();
  private performanceMetrics: ScoringPerformanceMetrics;

  constructor(config: ScoringConfig) {
    super();
    this.config = config;
    this.performanceBenchmarks = config.performanceBenchmarks;
    this.timeDecayFactors = config.timeDecayFactors;
    this.mobileOptimizations = config.mobileOptimizations;
    this.performanceMetrics = new ScoringPerformanceMetrics();
  }

  /**
   * Calculate comprehensive score for a challenge submission
   */
  async calculateScore(
    submission: ChallengeSubmission,
    context: ChallengeContext
  ): Promise<ChallengeScore> {
    const startTime = Date.now();

    try {
      // Check cache first for performance
      const cacheKey = this.generateCacheKey(submission, context);
      const cachedScore = this.scoringCache.get(cacheKey);
      if (cachedScore && this.isCacheValid(cachedScore)) {
        this.performanceMetrics.recordCacheHit();
        return cachedScore;
      }

      // Get or initialize player history
      const playerHistory = await this.getPlayerScoringHistory(submission.playerId);

      // Calculate individual dimension scores
      const accuracyScore = await this.calculateAccuracyScore(submission, context);
      const speedScore = await this.calculateSpeedScore(submission, context);
      const confidenceScore = await this.calculateConfidenceScore(submission, context, playerHistory);
      const reasoningScore = await this.calculateReasoningScore(submission, context);

      // Get adaptive weights based on player history and challenge type
      const weights = this.config.adaptiveWeightingEnabled
        ? await this.getAdaptiveWeights(submission.playerId, context, playerHistory)
        : this.config.defaultWeights;

      // Calculate weighted overall score
      const overallScore = this.calculateWeightedScore({
        accuracy: accuracyScore,
        speed: speedScore,
        confidence: confidenceScore,
        reasoning: reasoningScore
      }, weights);

      // Generate detailed breakdown
      const breakdown = this.generateDetailedBreakdown(
        accuracyScore, speedScore, confidenceScore, reasoningScore, weights
      );

      // Analyze confidence calibration
      const confidenceCalibration = await this.analyzeConfidenceCalibration(
        submission, context, accuracyScore
      );

      // Generate performance insights
      const performanceInsights = await this.generatePerformanceInsights(
        submission.playerId, overallScore, breakdown, confidenceCalibration
      );

      // Assess skill development
      const skillAssessment = await this.assessSkillDevelopment(
        submission.playerId, context, breakdown
      );

      // Create comprehensive score object
      const score: ChallengeScore = {
        overall: overallScore,
        accuracy: accuracyScore,
        speed: speedScore,
        confidence: confidenceScore,
        reasoning: reasoningScore,
        breakdown,
        confidenceCalibration,
        performanceInsights,
        skillAssessment
      };

      // Cache the score for performance
      this.scoringCache.set(cacheKey, score);

      // Update player history
      await this.updatePlayerScoringHistory(submission.playerId, score, context);

      // Record performance metrics
      this.performanceMetrics.recordScoringCompletion(Date.now() - startTime);

      // Emit scoring completed event
      this.emit('scoring:completed', { submission, context, score });

      return score;

    } catch (error) {
      this.performanceMetrics.recordError('score_calculation', error);
      throw new ScoringSystemError('Failed to calculate challenge score', error);
    }
  }

  /**
   * Calculate accuracy score based on answer correctness
   */
  private async calculateAccuracyScore(
    submission: ChallengeSubmission,
    context: ChallengeContext
  ): Promise<number> {
    let accuracy = 0;

    if (Array.isArray(context.correctAnswer)) {
      // Multiple correct answers - calculate partial credit
      const correctSelections = submission.answer.selectedOptions.filter(option =>
        context.correctAnswer.includes(option)
      );
      const totalCorrect = context.correctAnswer.length;
      const totalSelected = submission.answer.selectedOptions.length;

      if (totalSelected === 0) {
        accuracy = 0;
      } else {
        // Calculate precision and recall
        const precision = correctSelections.length / totalSelected;
        const recall = correctSelections.length / totalCorrect;
        accuracy = (2 * precision * recall) / (precision + recall); // F1 score
      }
    } else {
      // Single correct answer
      accuracy = submission.answer.selectedOptions.includes(context.correctAnswer) ? 1.0 : 0.0;
    }

    // Apply time decay if response was slow
    if (context.timeLimit && submission.responseTime > context.timeLimit) {
      const timeOverage = submission.responseTime - context.timeLimit;
      const decayFactor = Math.exp(-this.timeDecayFactors.accuracyDecayRate * timeOverage / 1000);
      accuracy *= decayFactor;
    }

    // Apply mobile-specific adjustments
    accuracy = this.applyMobileOptimizations(accuracy, submission);

    return Math.max(0, Math.min(1, accuracy));
  }

  /**
   * Calculate speed score based on response time
   */
  private async calculateSpeedScore(
    submission: ChallengeSubmission,
    context: ChallengeContext
  ): Promise<number> {
    if (!context.timeLimit) {
      return 0.5; // Neutral score if no time limit
    }

    const timeRatio = submission.responseTime / context.timeLimit;
    let speedScore = 0;

    if (timeRatio <= 0.3) {
      speedScore = 1.0; // Very fast
    } else if (timeRatio <= 0.6) {
      speedScore = 0.8; // Fast
    } else if (timeRatio <= 1.0) {
      speedScore = 0.6; // On time
    } else {
      // Apply time penalty
      const overageRatio = (timeRatio - 1.0);
      speedScore = Math.max(0, 0.6 - overageRatio * 0.4);
    }

    // Apply mobile latency compensation
    const latencyCompensation = this.calculateLatencyCompensation(submission);
    speedScore = Math.max(0, speedScore - latencyCompensation);

    return Math.max(0, Math.min(1, speedScore));
  }

  /**
   * Calculate confidence calibration score
   */
  private async calculateConfidenceScore(
    submission: ChallengeSubmission,
    context: ChallengeContext,
    playerHistory: PlayerScoringHistory
  ): Promise<number> {
    if (!this.config.confidenceCalibrationEnabled) {
      return 0.5; // Neutral score if disabled
    }

    const statedConfidence = submission.confidence;
    const actualAccuracy = await this.getHistoricalAccuracy(submission.playerId, context.type, playerHistory);

    // Calculate calibration accuracy
    const calibrationDifference = Math.abs(statedConfidence - actualAccuracy);
    const calibrationScore = Math.max(0, 1 - calibrationDifference * 2);

    // Apply historical calibration trend
    const historicalCalibration = playerHistory.averageConfidenceCalibration;
    const trendAdjustment = this.calculateCalibrationTrendAdjustment(historicalCalibration);

    return Math.max(0, Math.min(1, calibrationScore + trendAdjustment));
  }

  /**
   * Calculate reasoning quality score
   */
  private async calculateReasoningScore(
    submission: ChallengeSubmission,
    context: ChallengeContext
  ): Promise<number> {
    const reasoning = submission.answer.reasoning || '';
    const evidence = submission.answer.evidence || [];
    const sources = submission.answer.sources || [];

    let reasoningScore = 0;

    // Base score from reasoning text quality
    if (reasoning.length > 0) {
      const wordCount = reasoning.split(' ').length;
      const qualityIndicators = this.analyzeReasoningQuality(reasoning);

      reasoningScore = Math.min(1, (wordCount / 100) * 0.3 + qualityIndicators * 0.7);
    }

    // Bonus for providing evidence
    if (evidence.length > 0) {
      reasoningScore += 0.2;
    }

    // Bonus for citing sources
    if (sources.length > 0) {
      reasoningScore += 0.1;
    }

    // Apply challenge type specific adjustments
    reasoningScore = this.applyChallengeTypeAdjustments(reasoningScore, context);

    return Math.max(0, Math.min(1, reasoningScore));
  }

  /**
   * Get adaptive scoring weights based on player history
   */
  private async getAdaptiveWeights(
    playerId: string,
    context: ChallengeContext,
    history: PlayerScoringHistory
  ): Promise<ScoringWeights> {
    const baseWeights = { ...this.config.defaultWeights };

    // Adjust weights based on player strengths and weaknesses
    const strengths = history.strengths;
    const weaknesses = history.weaknesses;

    // Increase weight for weak areas to encourage improvement
    if (weaknesses.includes('accuracy') && baseWeights.accuracy < 0.5) {
      baseWeights.accuracy += 0.1;
      baseWeights.speed -= 0.05;
    }

    if (weaknesses.includes('speed') && baseWeights.speed < 0.3) {
      baseWeights.speed += 0.1;
      baseWeights.accuracy -= 0.05;
    }

    if (weaknesses.includes('confidence') && baseWeights.confidence < 0.3) {
      baseWeights.confidence += 0.1;
      baseWeights.reasoning -= 0.05;
    }

    // Adjust based on challenge type
    switch (context.type) {
      case ChallengeType.BIAS_DETECTION:
        baseWeights.accuracy += 0.1;
        baseWeights.reasoning += 0.05;
        break;

      case ChallengeType.RESEARCH_WORKFLOW:
        baseWeights.reasoning += 0.15;
        baseWeights.confidence += 0.05;
        break;

      case ChallengeType.ETHICAL_SCENARIO:
        baseWeights.reasoning += 0.2;
        baseWeights.confidence += 0.1;
        break;
    }

    // Normalize weights to sum to 1
    const totalWeight = Object.values(baseWeights).reduce((sum, weight) => sum + weight, 0);
    Object.keys(baseWeights).forEach(key => {
      baseWeights[key as keyof ScoringWeights] /= totalWeight;
    });

    return baseWeights;
  }

  /**
   * Analyze confidence calibration accuracy
   */
  private async analyzeConfidenceCalibration(
    submission: ChallengeSubmission,
    context: ChallengeContext,
    accuracyScore: number
  ): Promise<ConfidenceCalibrationResult> {
    const statedConfidence = submission.confidence;
    const actualConfidence = accuracyScore;

    const calibrationDifference = Math.abs(statedConfidence - actualConfidence);
    const calibrationAccuracy = Math.max(0, 1 - calibrationDifference);

    let overconfidencePenalty = 0;
    let underconfidencePenalty = 0;

    if (statedConfidence > actualConfidence + 0.3) {
      // Overconfident
      overconfidencePenalty = (statedConfidence - actualConfidence) * 0.5;
    } else if (actualConfidence > statedConfidence + 0.3) {
      // Underconfident
      underconfidencePenalty = (actualConfidence - statedConfidence) * 0.3;
    }

    const recommendations = this.generateCalibrationRecommendations(
      statedConfidence, actualConfidence, calibrationAccuracy
    );

    return {
      statedConfidence,
      actualConfidence,
      calibrationScore: calibrationAccuracy,
      calibrationAccuracy,
      overconfidencePenalty,
      underconfidencePenalty,
      recommendations
    };
  }

  /**
   * Generate performance insights
   */
  private async generatePerformanceInsights(
    playerId: string,
    overallScore: number,
    breakdown: DetailedScoreBreakdown,
    calibration: ConfidenceCalibrationResult
  ): Promise<PerformanceInsights> {
    const history = await this.getPlayerScoringHistory(playerId);

    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const improvementAreas: string[] = [];

    // Analyze score breakdown for insights
    if (breakdown.accuracyScore > 0.8) {
      strengths.push('high_accuracy');
    } else if (breakdown.accuracyScore < 0.5) {
      weaknesses.push('accuracy_improvement_needed');
      improvementAreas.push('focus_on_answer_precision');
    }

    if (breakdown.speedScore > 0.8) {
      strengths.push('quick_thinking');
    } else if (breakdown.speedScore < 0.4) {
      weaknesses.push('speed_development');
      improvementAreas.push('work_on_time_management');
    }

    if (calibration.calibrationAccuracy > 0.8) {
      strengths.push('well_calibrated_confidence');
    } else {
      weaknesses.push('confidence_calibration');
      improvementAreas.push('improve_confidence_assessment');
    }

    if (breakdown.reasoningScore > 0.8) {
      strengths.push('strong_reasoning');
    } else if (breakdown.reasoningScore < 0.5) {
      weaknesses.push('reasoning_development');
      improvementAreas.push('develop_structured_thinking');
    }

    // Calculate learning progression
    const currentLevel = Math.floor(history.totalExperience / 1000) + 1;
    const progressToNextLevel = (history.totalExperience % 1000) / 1000;

    return {
      strengths,
      weaknesses,
      improvementAreas,
      learningProgression: {
        currentLevel,
        progressToNextLevel,
        experienceGained: history.totalExperience,
        skillGaps: weaknesses,
        masteredSkills: strengths
      },
      nextSkillTargets: this.identifyNextSkillTargets(strengths, weaknesses),
      estimatedTimeToNextLevel: this.estimateTimeToNextLevel(currentLevel, overallScore)
    };
  }

  /**
   * Assess skill development and competency levels
   */
  private async assessSkillDevelopment(
    playerId: string,
    context: ChallengeContext,
    breakdown: DetailedScoreBreakdown
  ): Promise<SkillAssessment> {
    const history = await this.getPlayerScoringHistory(playerId);
    const skillScores = new Map<string, number>();
    const skillProgression = new Map<string, number>();
    const skillRecommendations = new Map<string, string[]>();
    const competencyLevels = new Map<string, CompetencyLevel>();

    // Assess each skill targeted by the challenge
    for (const skill of context.skills) {
      const skillScore = this.calculateSkillScore(skill, breakdown, context);
      skillScores.set(skill, skillScore);

      const currentProgression = history.skillProgression.get(skill) || 0;
      skillProgression.set(skill, currentProgression + skillScore);

      const competencyLevel = this.determineCompetencyLevel(skillScore, currentProgression);
      competencyLevels.set(skill, competencyLevel);

      // Generate skill-specific recommendations
      const recommendations = this.generateSkillRecommendations(skill, skillScore, competencyLevel);
      skillRecommendations.set(skill, recommendations);
    }

    return {
      skillScores,
      skillProgression,
      skillRecommendations,
      competencyLevels
    };
  }

  // Helper methods for score calculations
  private calculateWeightedScore(
    scores: { accuracy: number; speed: number; confidence: number; reasoning: number },
    weights: ScoringWeights
  ): number {
    return (
      scores.accuracy * weights.accuracy +
      scores.speed * weights.speed +
      scores.confidence * weights.confidence +
      scores.reasoning * weights.reasoning
    );
  }

  private generateDetailedBreakdown(
    accuracyScore: number,
    speedScore: number,
    confidenceScore: number,
    reasoningScore: number,
    weights: ScoringWeights
  ): DetailedScoreBreakdown {
    const penalties: ScorePenalty[] = [];
    const bonuses: ScoreBonus[] = [];

    // Add penalties
    if (accuracyScore < 0.3) {
      penalties.push({
        type: PenaltyType.INCORRECT_ANSWER,
        amount: 0.2,
        reason: 'Multiple incorrect selections'
      });
    }

    if (speedScore < 0.4) {
      penalties.push({
        type: PenaltyType.TIME_EXCEEDED,
        amount: 0.1,
        reason: 'Response time exceeded recommended limit'
      });
    }

    // Add bonuses
    if (accuracyScore > 0.9) {
      bonuses.push({
        type: BonusType.PERFECT_ACCURACY,
        amount: 0.1,
        reason: 'Perfect answer accuracy'
      });
    }

    if (speedScore > 0.9) {
      bonuses.push({
        type: BonusType.FAST_RESPONSE,
        amount: 0.05,
        reason: 'Exceptionally quick and accurate response'
      });
    }

    return {
      accuracyScore,
      accuracyWeight: weights.accuracy,
      speedScore,
      speedWeight: weights.speed,
      confidenceScore,
      confidenceWeight: weights.confidence,
      reasoningScore,
      reasoningWeight: weights.reasoning,
      penalties,
      bonuses
    };
  }

  private async getHistoricalAccuracy(
    playerId: string,
    challengeType: ChallengeType,
    history: PlayerScoringHistory
  ): Promise<number> {
    const typeHistory = history.challengeTypeHistory.get(challengeType);
    if (!typeHistory || typeHistory.length === 0) {
      return 0.5; // Default for new players/challenge types
    }

    return typeHistory.reduce((sum, score) => sum + score.accuracy, 0) / typeHistory.length;
  }

  private calculateCalibrationTrendAdjustment(historicalCalibration: number): number {
    // Positive adjustment for improving calibration, negative for degrading
    return Math.max(-0.2, Math.min(0.2, historicalCalibration - 0.5));
  }

  private analyzeReasoningQuality(reasoning: string): number {
    let qualityScore = 0;

    // Check for structured reasoning
    if (reasoning.includes('because') || reasoning.includes('therefore')) {
      qualityScore += 0.2;
    }

    // Check for evidence-based reasoning
    if (reasoning.includes('evidence') || reasoning.includes('research') || reasoning.includes('study')) {
      qualityScore += 0.2;
    }

    // Check for logical connectors
    const logicalConnectors = ['however', 'furthermore', 'consequently', 'additionally', 'moreover'];
    const connectorCount = logicalConnectors.reduce((count, connector) => {
      return count + (reasoning.toLowerCase().split(connector).length - 1);
    }, 0);

    qualityScore += Math.min(0.3, connectorCount * 0.1);

    // Check for conclusion
    if (reasoning.includes('conclude') || reasoning.includes('summary') || reasoning.includes('result')) {
      qualityScore += 0.1;
    }

    return Math.min(1, qualityScore);
  }

  private applyChallengeTypeAdjustments(score: number, context: ChallengeContext): number {
    switch (context.type) {
      case ChallengeType.ETHICAL_SCENARIO:
        return score * 1.2; // Higher weight on reasoning for ethical challenges
      case ChallengeType.RESEARCH_WORKFLOW:
        return score * 1.1; // Slightly higher weight on reasoning for research
      default:
        return score;
    }
  }

  private applyMobileOptimizations(score: number, submission: ChallengeSubmission): number {
    const deviceAdjustment = this.mobileOptimizations.deviceTypeAdjustments.get(
      submission.metadata?.deviceType || 'unknown'
    ) || 1.0;

    const latencyCompensation = this.calculateLatencyCompensation(submission);

    return score * deviceAdjustment - latencyCompensation;
  }

  private calculateLatencyCompensation(submission: ChallengeSubmission): number {
    const baseLatency = submission.metadata?.networkLatency || 0;
    const compensation = baseLatency / 1000; // Convert ms to seconds

    return Math.min(0.2, compensation * this.mobileOptimizations.networkLatencyCompensation);
  }

  private generateCalibrationRecommendations(
    stated: number,
    actual: number,
    accuracy: number
  ): string[] {
    const recommendations: string[] = [];

    if (stated > actual + 0.2) {
      recommendations.push('Try to be more conservative with confidence ratings');
      recommendations.push('Review past challenges to understand your accuracy patterns');
    } else if (actual > stated + 0.2) {
      recommendations.push('You can be more confident in your correct answers');
      recommendations.push('Trust your reasoning when you feel certain');
    }

    if (accuracy < 0.6) {
      recommendations.push('Practice confidence calibration exercises');
      recommendations.push('Keep track of your confidence vs accuracy over time');
    }

    return recommendations;
  }

  private calculateSkillScore(
    skill: string,
    breakdown: DetailedScoreBreakdown,
    context: ChallengeContext
  ): number {
    // Different skills are assessed by different score dimensions
    const skillDimensionMap: Record<string, keyof DetailedScoreBreakdown> = {
      'accuracy': 'accuracyScore',
      'speed': 'speedScore',
      'confidence_calibration': 'confidenceScore',
      'critical_thinking': 'reasoningScore',
      'bias_detection': 'accuracyScore',
      'research_methodology': 'reasoningScore',
      'ethical_reasoning': 'reasoningScore'
    };

    const dimension = skillDimensionMap[skill] || 'reasoningScore';
    const baseScore = breakdown[dimension];

    // Apply skill-specific adjustments
    const skillMultiplier = this.getSkillMultiplier(skill, context);
    return Math.min(1, baseScore * skillMultiplier);
  }

  private getSkillMultiplier(skill: string, context: ChallengeContext): number {
    const multipliers: Record<string, number> = {
      'bias_detection': context.type === ChallengeType.BIAS_DETECTION ? 1.2 : 0.9,
      'research_methodology': context.type === ChallengeType.RESEARCH_WORKFLOW ? 1.2 : 0.9,
      'ethical_reasoning': context.type === ChallengeType.ETHICAL_SCENARIO ? 1.3 : 0.8,
      'critical_thinking': 1.1, // Always valuable
      'accuracy': 1.0,
      'speed': 0.9,
      'confidence_calibration': 1.0
    };

    return multipliers[skill] || 1.0;
  }

  private determineCompetencyLevel(score: number, progression: number): CompetencyLevel {
    const totalProgress = score + (progression / 10); // Normalize progression

    if (totalProgress >= 4.0) return CompetencyLevel.EXPERT;
    if (totalProgress >= 3.0) return CompetencyLevel.ADVANCED;
    if (totalProgress >= 2.0) return CompetencyLevel.INTERMEDIATE;
    if (totalProgress >= 1.0) return CompetencyLevel.BEGINNER;
    return CompetencyLevel.NOVICE;
  }

  private generateSkillRecommendations(
    skill: string,
    score: number,
    level: CompetencyLevel
  ): string[] {
    const recommendations: string[] = [];

    if (level === CompetencyLevel.NOVICE && score < 0.3) {
      recommendations.push(`Focus on building foundational ${skill} skills`);
      recommendations.push('Practice basic exercises before attempting complex challenges');
    } else if (level === CompetencyLevel.BEGINNER && score < 0.5) {
      recommendations.push(`Develop ${skill} through targeted practice`);
      recommendations.push('Review learning materials and examples');
    } else if (level === CompetencyLevel.INTERMEDIATE && score < 0.7) {
      recommendations.push(`Refine ${skill} with advanced challenges`);
      recommendations.push('Seek mentorship or advanced training');
    }

    return recommendations;
  }

  private identifyNextSkillTargets(strengths: string[], weaknesses: string[]): string[] {
    // Recommend skills to develop based on current profile
    const skillProgressionPath: Record<string, string[]> = {
      'accuracy': ['bias_detection', 'attention_to_detail'],
      'speed': ['time_management', 'quick_thinking'],
      'confidence_calibration': ['self_awareness', 'decision_making'],
      'critical_thinking': ['logical_reasoning', 'evidence_evaluation'],
      'bias_detection': ['pattern_recognition', 'linguistic_analysis'],
      'research_methodology': ['source_evaluation', 'citation_standards']
    };

    const targets: string[] = [];

    // Add skills that build on strengths
    strengths.forEach(strength => {
      const nextSkills = skillProgressionPath[strength] || [];
      targets.push(...nextSkills);
    });

    // Add complementary skills to address weaknesses
    weaknesses.forEach(weakness => {
      if (weakness.includes('accuracy')) {
        targets.push('attention_to_detail', 'bias_detection');
      }
      if (weakness.includes('speed')) {
        targets.push('time_management');
      }
      if (weakness.includes('confidence')) {
        targets.push('self_awareness');
      }
    });

    return [...new Set(targets)].slice(0, 5); // Limit to 5 recommendations
  }

  private estimateTimeToNextLevel(currentLevel: number, averageScore: number): number {
    const experienceNeeded = 1000 - (currentLevel * 100); // Simplified calculation
    const experiencePerChallenge = averageScore * 100;

    if (experiencePerChallenge <= 0) return Infinity;

    return Math.ceil(experienceNeeded / experiencePerChallenge);
  }

  // Cache management
  private generateCacheKey(submission: ChallengeSubmission, context: ChallengeContext): string {
    return `${submission.challengeId}_${submission.playerId}_${submission.submittedAt.getTime()}`;
  }

  private isCacheValid(score: ChallengeScore): boolean {
    // Cache is valid for 5 minutes
    const cacheAge = Date.now() - score.breakdown.accuracyScore; // Using accuracyScore as timestamp placeholder
    return cacheAge < 5 * 60 * 1000;
  }

  // Player history management
  private async getPlayerScoringHistory(playerId: string): Promise<PlayerScoringHistory> {
    if (this.playerHistory.has(playerId)) {
      return this.playerHistory.get(playerId)!;
    }

    const history: PlayerScoringHistory = {
      playerId,
      totalChallenges: 0,
      averageScore: 0,
      strengths: [],
      weaknesses: [],
      skillProgression: new Map(),
      challengeTypeHistory: new Map(),
      confidenceCalibrationHistory: [],
      averageConfidenceCalibration: 0.5,
      totalExperience: 0,
      lastUpdated: new Date()
    };

    this.playerHistory.set(playerId, history);
    return history;
  }

  private async updatePlayerScoringHistory(
    playerId: string,
    score: ChallengeScore,
    context: ChallengeContext
  ): Promise<void> {
    const history = await this.getPlayerScoringHistory(playerId);

    // Update counters
    history.totalChallenges++;
    history.totalExperience += Math.round(score.overall * 100);

    // Update average score
    history.averageScore = (history.averageScore * (history.totalChallenges - 1) + score.overall) / history.totalChallenges;

    // Update challenge type history
    if (!history.challengeTypeHistory.has(context.type)) {
      history.challengeTypeHistory.set(context.type, []);
    }
    history.challengeTypeHistory.get(context.type)!.push(score);

    // Update confidence calibration history
    history.confidenceCalibrationHistory.push(score.confidenceCalibration);
    if (history.confidenceCalibrationHistory.length > 10) {
      history.confidenceCalibrationHistory = history.confidenceCalibrationHistory.slice(-10);
    }

    // Recalculate average confidence calibration
    history.averageConfidenceCalibration = history.confidenceCalibrationHistory.reduce(
      (sum, cal) => sum + cal.calibrationAccuracy, 0
    ) / history.confidenceCalibrationHistory.length;

    // Update strengths and weaknesses
    await this.updatePlayerStrengthsAndWeaknesses(history, score);

    history.lastUpdated = new Date();
  }

  private async updatePlayerStrengthsAndWeaknesses(
    history: PlayerScoringHistory,
    score: ChallengeScore
  ): Promise<void> {
    // Simplified implementation - in practice would use more sophisticated analysis
    if (score.accuracy > 0.8 && !history.strengths.includes('accuracy')) {
      history.strengths.push('accuracy');
    }

    if (score.speed > 0.8 && !history.strengths.includes('speed')) {
      history.strengths.push('speed');
    }

    if (score.confidenceCalibration.calibrationAccuracy > 0.8 && !history.strengths.includes('confidence')) {
      history.strengths.push('confidence');
    }

    if (score.accuracy < 0.5 && !history.weaknesses.includes('accuracy')) {
      history.weaknesses.push('accuracy');
    }

    if (score.confidenceCalibration.calibrationAccuracy < 0.5 && !history.weaknesses.includes('confidence')) {
      history.weaknesses.push('confidence');
    }
  }
}

// Supporting interfaces and classes
export interface PlayerScoringHistory {
  playerId: string;
  totalChallenges: number;
  averageScore: number;
  strengths: string[];
  weaknesses: string[];
  skillProgression: Map<string, number>;
  challengeTypeHistory: Map<ChallengeType, ChallengeScore[]>;
  confidenceCalibrationHistory: ConfidenceCalibrationResult[];
  averageConfidenceCalibration: number;
  totalExperience: number;
  lastUpdated: Date;
}

export class ScoringSystemError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = 'ScoringSystemError';
  }
}

export class ScoringPerformanceMetrics {
  private metrics: Map<string, number[]> = new Map();
  private cacheHits: number = 0;
  private totalCalculations: number = 0;

  recordScoringCompletion(duration: number): void {
    this.recordMetric('scoring_time', duration);
    this.totalCalculations++;
  }

  recordCacheHit(): void {
    this.cacheHits++;
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

  getAverageScoringTime(): number {
    return this.getAverageMetric('scoring_time');
  }

  getCacheHitRate(): number {
    return this.totalCalculations > 0 ? this.cacheHits / this.totalCalculations : 0;
  }

  getErrorCount(type?: string): number {
    const key = type ? `error:${type}` : 'error';
    return (this.metrics.get(key) || []).reduce((sum, val) => sum + val, 0);
  }

  private getAverageMetric(key: string): number {
    const values = this.metrics.get(key) || [];
    return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
  }
}

// Default configuration
export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  defaultWeights: {
    accuracy: 0.4,
    speed: 0.2,
    confidence: 0.2,
    reasoning: 0.2
  },
  confidenceCalibrationEnabled: true,
  adaptiveWeightingEnabled: true,
  performanceBenchmarks: {
    averageResponseTime: 30000, // 30 seconds
    accuracyThresholds: new Map([
      [Difficulty.BEGINNER, 0.6],
      [Difficulty.INTERMEDIATE, 0.7],
      [Difficulty.ADVANCED, 0.8],
      [Difficulty.EXPERT, 0.9]
    ]),
    speedThresholds: new Map([
      [Difficulty.BEGINNER, 0.5],
      [Difficulty.INTERMEDIATE, 0.6],
      [Difficulty.ADVANCED, 0.7],
      [Difficulty.EXPERT, 0.8]
    ]),
    reasoningQualityStandards: new Map([
      [ChallengeType.BIAS_DETECTION, 0.7],
      [ChallengeType.RESEARCH_WORKFLOW, 0.8],
      [ChallengeType.CONTEXT_EVALUATION, 0.7],
      [ChallengeType.ETHICAL_SCENARIO, 0.9],
      [ChallengeType.RESEARCH_INVESTIGATION, 0.8],
      [ChallengeType.CROSS_MODAL_CHALLENGE, 0.8]
    ])
  },
  timeDecayFactors: {
    speedDecayRate: 0.001,
    accuracyDecayRate: 0.0005,
    reasoningDecayRate: 0.0002,
    confidenceDecayRate: 0.0001
  },
  mobileOptimizations: {
    networkLatencyCompensation: 0.1,
    deviceTypeAdjustments: new Map([
      ['mobile', 0.95],
      ['tablet', 0.98],
      ['desktop', 1.0]
    ]),
    batteryOptimizationMode: false,
    reducedPrecisionMode: false
  }
};