import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Game, Challenge, GameState as GameStateType } from '../../../types';

const initialState: GameStateType = {
  currentGame: null,
  currentChallenge: null,
  currentChallengeIndex: 0,
  totalChallenges: 0,
  score: 0,
  streak: 0,
  isLoading: false,
  error: null,
};

const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    startGame: (state, action: PayloadAction<{ game: Game; totalChallenges: number }>) => {
      state.currentGame = action.payload.game;
      state.totalChallenges = action.payload.totalChallenges;
      state.currentChallengeIndex = 0;
      state.score = 0;
      state.streak = 0;
      state.error = null;
    },
    setChallenge: (state, action: PayloadAction<Challenge>) => {
      state.currentChallenge = action.payload;
      state.isLoading = false;
    },
    submitAnswer: (state, action: PayloadAction<{ correct: boolean; points: number }>) => {
      if (action.payload.correct) {
        state.score += action.payload.points;
        state.streak += 1;
      } else {
        state.streak = 0;
      }
      state.currentChallengeIndex += 1;
    },
    endGame: (state) => {
      if (state.currentGame) {
        state.currentGame.status = 'completed';
        state.currentGame.score = state.score;
      }
      state.currentChallenge = null;
    },
    resetGame: (state) => {
      state.currentGame = null;
      state.currentChallenge = null;
      state.currentChallengeIndex = 0;
      state.totalChallenges = 0;
      state.score = 0;
      state.streak = 0;
      state.isLoading = false;
      state.error = null;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.isLoading = false;
    },
  },
});

export const {
  startGame,
  setChallenge,
  submitAnswer,
  endGame,
  resetGame,
  setLoading,
  setError,
} = gameSlice.actions;

export default gameSlice.reducer;