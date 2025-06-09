import { describe, it, expect, vi } from 'vitest';
import authReducer, {
  login,
  logout,
  refreshToken,
  updateUser,
  setLoading,
  setError,
  clearError,
  AuthState,
} from '../authSlice';

describe('authSlice', () => {
  const initialState: AuthState = {
    user: null,
    accessToken: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  };

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    username: 'testuser',
    role: 'player' as const,
    xp: 100,
    level: 1,
    createdAt: '2024-01-01T00:00:00Z',
  };

  it('should return the initial state', () => {
    expect(authReducer(undefined, { type: 'unknown' })).toEqual(initialState);
  });

  describe('login', () => {
    it('should handle successful login', () => {
      const payload = {
        user: mockUser,
        accessToken: 'test-token',
      };

      const state = authReducer(initialState, login(payload));

      expect(state.user).toEqual(mockUser);
      expect(state.accessToken).toBe('test-token');
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('logout', () => {
    it('should handle logout', () => {
      const loggedInState: AuthState = {
        user: mockUser,
        accessToken: 'test-token',
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };

      const state = authReducer(loggedInState, logout());

      expect(state).toEqual(initialState);
    });
  });

  describe('refreshToken', () => {
    it('should update access token', () => {
      const loggedInState: AuthState = {
        user: mockUser,
        accessToken: 'old-token',
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };

      const state = authReducer(loggedInState, refreshToken('new-token'));

      expect(state.accessToken).toBe('new-token');
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
    });
  });

  describe('updateUser', () => {
    it('should update user data', () => {
      const loggedInState: AuthState = {
        user: mockUser,
        accessToken: 'test-token',
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };

      const updates = {
        xp: 200,
        level: 2,
        username: 'newusername',
      };

      const state = authReducer(loggedInState, updateUser(updates));

      expect(state.user).toEqual({
        ...mockUser,
        ...updates,
      });
    });

    it('should not update if user is null', () => {
      const state = authReducer(initialState, updateUser({ xp: 200 }));
      expect(state.user).toBeNull();
    });
  });

  describe('loading state', () => {
    it('should set loading state', () => {
      const state = authReducer(initialState, setLoading(true));
      expect(state.isLoading).toBe(true);
    });

    it('should unset loading state', () => {
      const loadingState: AuthState = {
        ...initialState,
        isLoading: true,
      };

      const state = authReducer(loadingState, setLoading(false));
      expect(state.isLoading).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should set error', () => {
      const state = authReducer(initialState, setError('Invalid credentials'));
      expect(state.error).toBe('Invalid credentials');
      expect(state.isLoading).toBe(false);
    });

    it('should clear error', () => {
      const errorState: AuthState = {
        ...initialState,
        error: 'Some error',
      };

      const state = authReducer(errorState, clearError());
      expect(state.error).toBeNull();
    });
  });

  describe('async thunks', () => {
    // These would test the async actions if we had them
    it('should handle pending login', () => {
      // Mock implementation for async thunk testing
    });

    it('should handle fulfilled login', () => {
      // Mock implementation for async thunk testing
    });

    it('should handle rejected login', () => {
      // Mock implementation for async thunk testing
    });
  });
});