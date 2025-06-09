export type ChallengeType = 'text' | 'image';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type Provider = 'openai' | 'anthropic';

export interface GenerateContentRequest {
  type: ChallengeType;
  difficulty: Difficulty;
  topic: string;
  provider?: Provider;
}

export interface GeneratedContent {
  type: ChallengeType;
  content: string;
  metadata: {
    model: string;
    difficulty: Difficulty;
    topic: string;
    timestamp?: string;
    complexity?: ComplexityAnalysis;
  };
}

export interface DetectContentRequest {
  type: ChallengeType;
  content: string;
}

export interface DetectionResult {
  isAI: boolean;
  confidence: number;
  indicators: string[];
}

export interface ComplexityAnalysis {
  readabilityScore: number;
  vocabularyLevel: string;
  sentenceComplexity: string;
}

export interface ExplanationRequest {
  content: string;
  isAI: boolean;
  indicators: string[];
}

export interface ValidationResult {
  isValid: boolean;
  issues: string[];
}

export interface TextGenerationParams {
  difficulty: Difficulty;
  topic: string;
  minLength?: number;
  maxLength?: number;
  style?: string;
}

export interface ImageGenerationParams {
  difficulty: Difficulty;
  topic: string;
  style?: string;
  size?: '1024x1024' | '1792x1024' | '1024x1792';
}