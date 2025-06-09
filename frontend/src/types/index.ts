export interface User {
  id: string;
  email: string;
  username: string;
  avatar?: string;
  role: 'player' | 'researcher' | 'admin';
  xp: number;
  level: number;
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface Game {
  id: string;
  mode: GameMode;
  status: GameStatus;
  score: number;
  accuracy?: number;
  startedAt: string;
  completedAt?: string;
}

export interface Challenge {
  id: string;
  type: 'text' | 'image';
  content: string;
}

export interface GameState {
  currentGame: Game | null;
  currentChallenge: Challenge | null;
  currentChallengeIndex: number;
  totalChallenges: number;
  score: number;
  streak: number;
  isLoading: boolean;
  error: string | null;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatar?: string;
  score: number;
  games: number;
}

export interface SocialState {
  leaderboard: LeaderboardEntry[];
  friends: User[];
  guilds: Guild[];
  isLoading: boolean;
  error: string | null;
}

export interface Guild {
  id: string;
  name: string;
  description: string;
  icon?: string;
  memberCount: number;
  maxMembers: number;
  isPublic: boolean;
}

export type GameMode = 'quick-play' | 'daily-challenge' | 'research-mode' | 'tournament';
export type GameStatus = 'active' | 'completed' | 'abandoned';

export interface ApiResponse<T> {
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}