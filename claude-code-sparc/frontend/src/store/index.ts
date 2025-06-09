import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import gameReducer from './slices/gameSlice';
import socialReducer from './slices/socialSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    game: gameReducer,
    social: socialReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;