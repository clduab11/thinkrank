import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { store } from '../store';
import { refreshToken as refreshTokenAction, logout } from '../store/slices/authSlice';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

class ApiService {
  private axiosInstance: AxiosInstance;
  private refreshPromise: Promise<string> | null = null;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor to add auth token
    this.axiosInstance.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const state = store.getState();
        const token = state.auth.accessToken;
        
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        
        return config;
      },
      (error: AxiosError) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle token refresh
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const newToken = await this.refreshToken();
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            }
            return this.axiosInstance(originalRequest);
          } catch (refreshError) {
            store.dispatch(logout());
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private async refreshToken(): Promise<string> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.performTokenRefresh();
    }

    try {
      const token = await this.refreshPromise;
      this.refreshPromise = null;
      return token;
    } catch (error) {
      this.refreshPromise = null;
      throw error;
    }
  }

  private async performTokenRefresh(): Promise<string> {
    const response = await this.axiosInstance.post('/auth/refresh');
    const { accessToken } = response.data;
    store.dispatch(refreshTokenAction(accessToken));
    return accessToken;
  }

  // Auth endpoints
  async login(email: string, password: string) {
    return this.axiosInstance.post('/auth/login', { email, password });
  }

  async register(email: string, password: string, username: string) {
    return this.axiosInstance.post('/auth/register', { email, password, username });
  }

  async logout() {
    return this.axiosInstance.post('/auth/logout');
  }

  // Game endpoints
  async startGame(mode: string) {
    return this.axiosInstance.post('/games/start', { mode });
  }

  async getNextChallenge(gameId: string) {
    return this.axiosInstance.get(`/games/${gameId}/next-challenge`);
  }

  async submitAnswer(gameId: string, challengeId: string, isAI: boolean, confidence?: number) {
    return this.axiosInstance.post(`/games/${gameId}/submit`, {
      challengeId,
      isAI,
      confidence,
    });
  }

  async endGame(gameId: string) {
    return this.axiosInstance.post(`/games/${gameId}/end`);
  }

  // Social endpoints
  async getLeaderboard(timeframe: string = 'daily', limit: number = 10) {
    return this.axiosInstance.get('/social/leaderboard', {
      params: { timeframe, limit },
    });
  }

  async getFriends() {
    return this.axiosInstance.get('/social/friends');
  }

  async addFriend(userId: string) {
    return this.axiosInstance.post('/social/friends', { userId });
  }

  async removeFriend(userId: string) {
    return this.axiosInstance.delete(`/social/friends/${userId}`);
  }

  async getGuilds() {
    return this.axiosInstance.get('/social/guilds');
  }

  async joinGuild(guildId: string) {
    return this.axiosInstance.post(`/social/guilds/${guildId}/join`);
  }

  async leaveGuild(guildId: string) {
    return this.axiosInstance.post(`/social/guilds/${guildId}/leave`);
  }

  // User endpoints
  async getProfile() {
    return this.axiosInstance.get('/users/profile');
  }

  async updateProfile(updates: any) {
    return this.axiosInstance.patch('/users/profile', updates);
  }

  async getStats() {
    return this.axiosInstance.get('/users/stats');
  }
}

export default new ApiService();