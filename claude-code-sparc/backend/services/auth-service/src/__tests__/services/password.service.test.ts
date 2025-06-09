import { PasswordService } from '../../services/password.service';
import argon2 from 'argon2';

jest.mock('argon2');

describe('PasswordService', () => {
  let passwordService: PasswordService;
  const mockArgon2 = argon2 as jest.Mocked<typeof argon2>;

  beforeEach(() => {
    passwordService = new PasswordService();
    jest.clearAllMocks();
  });

  describe('hash', () => {
    it('should hash a password successfully', async () => {
      const password = 'SecurePassword123!';
      const hashedPassword = 'hashed_password_value';

      mockArgon2.hash.mockResolvedValue(hashedPassword);

      const result = await passwordService.hash(password);

      expect(mockArgon2.hash).toHaveBeenCalledWith(password);
      expect(result).toBe(hashedPassword);
    });

    it('should throw error if hashing fails', async () => {
      const password = 'SecurePassword123!';
      const error = new Error('Hashing failed');

      mockArgon2.hash.mockRejectedValue(error);

      await expect(passwordService.hash(password)).rejects.toThrow(
        'Failed to hash password'
      );
    });
  });

  describe('verify', () => {
    it('should verify a correct password', async () => {
      const password = 'SecurePassword123!';
      const hash = 'hashed_password_value';

      mockArgon2.verify.mockResolvedValue(true);

      const result = await passwordService.verify(password, hash);

      expect(mockArgon2.verify).toHaveBeenCalledWith(hash, password);
      expect(result).toBe(true);
    });

    it('should return false for incorrect password', async () => {
      const password = 'WrongPassword123!';
      const hash = 'hashed_password_value';

      mockArgon2.verify.mockResolvedValue(false);

      const result = await passwordService.verify(password, hash);

      expect(mockArgon2.verify).toHaveBeenCalledWith(hash, password);
      expect(result).toBe(false);
    });

    it('should throw error if verification fails', async () => {
      const password = 'SecurePassword123!';
      const hash = 'hashed_password_value';
      const error = new Error('Verification failed');

      mockArgon2.verify.mockRejectedValue(error);

      await expect(passwordService.verify(password, hash)).rejects.toThrow(
        'Failed to verify password'
      );
    });
  });
});