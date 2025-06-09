import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { LeaderboardEntry, User, Guild, SocialState } from '../../../types';

const initialState: SocialState = {
  leaderboard: [],
  friends: [],
  guilds: [],
  isLoading: false,
  error: null,
};

const socialSlice = createSlice({
  name: 'social',
  initialState,
  reducers: {
    setLeaderboard: (state, action: PayloadAction<LeaderboardEntry[]>) => {
      state.leaderboard = action.payload;
      state.isLoading = false;
    },
    setFriends: (state, action: PayloadAction<User[]>) => {
      state.friends = action.payload;
      state.isLoading = false;
    },
    addFriend: (state, action: PayloadAction<User>) => {
      state.friends.push(action.payload);
    },
    removeFriend: (state, action: PayloadAction<string>) => {
      state.friends = state.friends.filter(friend => friend.id !== action.payload);
    },
    setGuilds: (state, action: PayloadAction<Guild[]>) => {
      state.guilds = action.payload;
      state.isLoading = false;
    },
    joinGuild: (state, action: PayloadAction<Guild>) => {
      state.guilds.push(action.payload);
    },
    leaveGuild: (state, action: PayloadAction<string>) => {
      state.guilds = state.guilds.filter(guild => guild.id !== action.payload);
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.isLoading = false;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
});

export const {
  setLeaderboard,
  setFriends,
  addFriend,
  removeFriend,
  setGuilds,
  joinGuild,
  leaveGuild,
  setLoading,
  setError,
  clearError,
} = socialSlice.actions;

export default socialSlice.reducer;