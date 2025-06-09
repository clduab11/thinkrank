export const CONSTANTS = {
  GAME_MODES: {
    QUICK_PLAY: 'quick-play',
    DAILY_CHALLENGE: 'daily-challenge',
    RESEARCH_MODE: 'research-mode',
    TOURNAMENT: 'tournament',
  },
  
  USER_ROLES: {
    PLAYER: 'player',
    RESEARCHER: 'researcher',
    ADMIN: 'admin',
  },
  
  CHALLENGE_TYPES: {
    TEXT: 'text',
    IMAGE: 'image',
  },
  
  DIFFICULTY_LEVELS: {
    EASY: 0.3,
    MEDIUM: 0.6,
    HARD: 0.9,
  },
  
  SCORING: {
    BASE_SCORE: 100,
    TIME_BONUS_MAX: 50,
    STREAK_BONUS_MULTIPLIER: 10,
    STREAK_BONUS_MAX: 100,
  },
  
  CACHE_TTL: {
    USER_SESSION: 900, // 15 minutes
    LEADERBOARD: 60, // 1 minute
    GAME_STATE: 3600, // 1 hour
    CHALLENGE_POOL: 300, // 5 minutes
  },
  
  LIMITS: {
    MAX_USERNAME_LENGTH: 20,
    MIN_PASSWORD_LENGTH: 8,
    MAX_GAMES_PER_DAY: 100,
    MAX_GUILD_MEMBERS: 50,
  },
} as const;