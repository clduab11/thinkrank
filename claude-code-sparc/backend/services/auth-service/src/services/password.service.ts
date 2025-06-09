import argon2 from 'argon2';
import type { IPasswordService } from './interfaces/password.service.interface';

export class PasswordService implements IPasswordService {
  async hash(password: string): Promise<string> {
    try {
      return await argon2.hash(password);
    } catch (error) {
      throw new Error('Failed to hash password');
    }
  }

  async verify(password: string, hash: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch (error) {
      throw new Error('Failed to verify password');
    }
  }
}