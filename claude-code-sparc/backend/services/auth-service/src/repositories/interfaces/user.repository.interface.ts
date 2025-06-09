import type { User } from '../../types/auth.types';

export interface IUserRepository {
  create(data: CreateUserData): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  update(id: string, data: Partial<User>): Promise<User>;
  delete(id: string): Promise<boolean>;
}

export interface CreateUserData {
  email: string;
  username: string;
  passwordHash: string;
}