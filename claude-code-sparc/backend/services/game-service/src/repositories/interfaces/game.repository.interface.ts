import type { Game, ChallengeResponse } from '../../types/game.types';

export interface IGameRepository {
  create(data: CreateGameData): Promise<Game>;
  findById(id: string): Promise<Game | null>;
  findByUserId(userId: string, limit?: number): Promise<Game[]>;
  update(id: string, data: Partial<Game>): Promise<Game>;
  saveResponse(response: ChallengeResponse & { gameId: string }): Promise<void>;
}

export interface CreateGameData {
  userId: string;
  mode: string;
  challengeIds: string[];
}