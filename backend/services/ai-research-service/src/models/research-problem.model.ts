/**
 * AI Research Problem Models and Interfaces
 */

export enum ProblemType {
  BIAS_DETECTION = 'bias_detection',
  ALIGNMENT = 'alignment',
  CONTEXT_EVALUATION = 'context_evaluation'
}

export enum BiasType {
  POSITION_BIAS = 'position_bias',
  VERBOSITY_BIAS = 'verbosity_bias',
  CULTURAL_BIAS = 'cultural_bias',
  GENDER_BIAS = 'gender_bias',
  DEMOGRAPHIC_BIAS = 'demographic_bias'
}

export enum AlignmentType {
  VALUE_ALIGNMENT = 'value_alignment',
  ETHICAL_DECISIONS = 'ethical_decisions',
  HELPFULNESS_ASSESSMENT = 'helpfulness_assessment'
}

export enum ContextType {
  CULTURAL_CONTEXT = 'cultural_context',
  TEMPORAL_CONTEXT = 'temporal_context',
  DOMAIN_ADAPTATION = 'domain_adaptation'
}

export enum ValidationStatus {
  PENDING = 'pending',
  VALIDATED = 'validated',
  REJECTED = 'rejected'
}

export interface ResearchProblemData {
  // Bias Detection Data
  biasDetection?: {
    type: BiasType;
    scenarios: BiasScenario[];
    expectedPattern: string;
    evaluationCriteria: string[];
  };

  // Alignment Data
  alignment?: {
    type: AlignmentType;
    scenarios: AlignmentScenario[];
    valueFramework: string;
    evaluationRubric: EvaluationRubric;
  };

  // Context Evaluation Data
  contextEvaluation?: {
    type: ContextType;
    scenarios: ContextScenario[];
    culturalFramework?: string;
    temporalPeriod?: string;
    domainSpecifics?: string[];
  };
}

export interface BiasScenario {
  id: string;
  prompt: string;
  responses: ResponseOption[];
  biasPattern: string;
  explanation: string;
}

export interface AlignmentScenario {
  id: string;
  situation: string;
  options: AlignmentOption[];
  valueConflicts: string[];
  ethicalFramework: string;
}

export interface ContextScenario {
  id: string;
  baseScenario: string;
  contextVariants: ContextVariant[];
  expectedDifferences: string[];
}

export interface ResponseOption {
  id: string;
  text: string;
  biasScore: number;
  explanation: string;
  correctChoice?: boolean;
}

export interface AlignmentOption {
  id: string;
  action: string;
  description: string;
  valueAlignment: ValueAlignment;
  consequences: string[];
}

export interface ContextVariant {
  id: string;
  description: string;
  modifiedScenario: string;
  culturalContext?: string;
  temporalContext?: string;
  domainContext?: string;
}

export interface ValueAlignment {
  helpfulness: number;
  harmlessness: number;
  honesty: number;
  fairness: number;
  autonomy: number;
}

export interface EvaluationRubric {
  criteria: RubricCriterion[];
  scoringMethod: 'weighted_average' | 'threshold' | 'consensus';
  qualityThreshold: number;
}

export interface RubricCriterion {
  name: string;
  description: string;
  weight: number;
  scale: number;
}

export interface ResearchProblem {
  id: string;
  problemId: string;
  institutionId: string;
  institutionName: string;
  problemType: ProblemType;
  title: string;
  description: string;
  difficultyLevel: number;
  problemData: ResearchProblemData;
  validationCriteria: ValidationCriteria;
  expectedSolutionFormat: SolutionFormat;
  tags: string[];
  metadata: ProblemMetadata;
  active: boolean;
  totalContributions: number;
  qualityThreshold: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ValidationCriteria {
  requiredAccuracy: number;
  minimumContributions: number;
  expertValidationRequired: boolean;
  peerReviewThreshold: number;
  timeLimit?: number;
  validationMethod: 'automatic' | 'peer_review' | 'expert_review' | 'hybrid';
}

export interface SolutionFormat {
  responseType: 'single_choice' | 'multiple_choice' | 'ranking' | 'rating' | 'text' | 'classification';
  options?: string[];
  scaleMin?: number;
  scaleMax?: number;
  requiredFields: string[];
}

export interface ProblemMetadata {
  sourceDataset?: string;
  researchPaper?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  estimatedTime: number;
  gameCompatibility: GameCompatibility;
  learningObjectives: string[];
}

export interface GameCompatibility {
  rapidFire: boolean;
  comparison: boolean;
  ranking: boolean;
  scenarioBased: boolean;
  patternRecognition: boolean;
}

export interface ResearchContribution {
  id: string;
  contributionId: string;
  userId: string;
  problemId: string;
  solutionData: ContributionSolution;
  validationStatus: ValidationStatus;
  qualityScore?: number;
  confidenceScore?: number;
  timeSpentSeconds: number;
  submissionMethod: 'game' | 'direct' | 'api';
  peerReviews: PeerReview[];
  researchImpact: ResearchImpact;
  feedbackReceived: ContributionFeedback;
  pointsAwarded: number;
  submittedAt: Date;
  validatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContributionSolution {
  answers: AnswerData[];
  reasoning?: string;
  confidence: number;
  methodology?: string;
  timeBreakdown?: TimeBreakdown;
}

export interface AnswerData {
  questionId: string;
  answer: any;
  confidence: number;
  reasoning?: string;
  metadata?: any;
}

export interface TimeBreakdown {
  readingTime: number;
  analysisTime: number;
  responseTime: number;
  reviewTime: number;
}

export interface PeerReview {
  reviewerId: string;
  score: number;
  feedback: string;
  criteria: ReviewCriteria;
  reviewedAt: Date;
}

export interface ReviewCriteria {
  accuracy: number;
  thoroughness: number;
  clarity: number;
  methodology: number;
}

export interface ResearchImpact {
  citationCount: number;
  validationCount: number;
  replicationCount: number;
  improvementSuggestions: string[];
}

export interface ContributionFeedback {
  expertFeedback?: string;
  peerFeedback: string[];
  improvementSuggestions: string[];
  recognitions: string[];
}

/**
 * Game Mechanics Related Interfaces
 */

export interface GameProblem {
  id: string;
  researchProblemId: string;
  gameType: GameType;
  mechanicsConfig: GameMechanicsConfig;
  difficultyProgression: DifficultyProgression;
  playerLevel: number;
  adaptiveParameters: AdaptiveParameters;
}

export enum GameType {
  RAPID_FIRE = 'rapid_fire',
  COMPARISON = 'comparison',
  RANKING = 'ranking',
  SCENARIO_BASED = 'scenario_based',
  PATTERN_RECOGNITION = 'pattern_recognition',
  PROGRESSIVE_CHALLENGE = 'progressive_challenge'
}

export interface GameMechanicsConfig {
  timeLimit?: number;
  scoreMultiplier: number;
  hintAvailable: boolean;
  skipAllowed: boolean;
  feedbackImmediate: boolean;
  progressionRequirement: ProgressionRequirement;
}

export interface ProgressionRequirement {
  minAccuracy: number;
  minSpeed: number;
  minConsistency: number;
  masteryCriteria: string[];
}

export interface DifficultyProgression {
  currentLevel: number;
  maxLevel: number;
  adaptationRate: number;
  performanceWindow: number;
  difficultyFactors: DifficultyFactor[];
}

export interface DifficultyFactor {
  name: string;
  currentValue: number;
  range: [number, number];
  impact: number;
}

export interface AdaptiveParameters {
  playerSkillEstimate: number;
  learningRate: number;
  performanceHistory: PerformanceMetric[];
  recommendedDifficulty: number;
}

export interface PerformanceMetric {
  timestamp: Date;
  accuracy: number;
  speed: number;
  consistency: number;
  engagement: number;
}
