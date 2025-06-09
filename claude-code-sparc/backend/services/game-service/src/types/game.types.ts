export interface Game {
  id: string;
  userId: string;
  mode: GameMode;
  status: GameStatus;
  score: number;
  accuracy?: number;
  startedAt: Date;
  completedAt?: Date;
  durationSeconds?: number;
  metadata?: Record<string, any>;
}

export interface GameSession {
  gameId: string;
  userId: string;
  mode: GameMode;
  currentChallengeIndex: number;
  challenges: Challenge[];
  responses: ChallengeResponse[];
  score: number;
  streak: number;
  startTime: number;
}

export interface Challenge {
  id: string;
  type: ChallengeType;
  content: string;
  isAiGenerated: boolean;
  difficulty: number;
  sourceInfo?: Record<string, any>;
}

export interface ChallengeResponse {
  challengeId: string;
  userAnswer: boolean;
  isCorrect?: boolean;
  timeSpent: number;
  scoreEarned?: number;
  submittedAt?: Date;
}

export interface CreateGameDto {
  userId: string;
  mode: GameMode;
}

export interface SubmitAnswerDto {
  challengeId: string;
  answer: boolean;
  timeSpent: number;
}

export interface GameResult {
  gameId: string;
  totalScore: number;
  accuracy: number;
  totalChallenges: number;
  correctAnswers: number;
  averageTimePerChallenge: number;
  longestStreak: number;
  achievements?: string[];
}

export interface ScoreCalculation {
  baseScore: number;
  timeBonus: number;
  streakBonus: number;
  difficultyMultiplier: number;
  totalScore: number;
  xpGained: number;
}

export type GameMode = 'quick-play' | 'daily-challenge' | 'research-mode' | 'tournament';
export type GameStatus = 'active' | 'completed' | 'abandoned';
export type ChallengeType = 'text' | 'image';

export interface LeaderboardEntry {
  userId: string;
  username: string;
  score: number;
  rank: number;
  games: number;
}