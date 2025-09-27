module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  moduleNameMapper: {
    '^(\\.{2}/services/.*)$': '<rootDir>/src/$1',
    '^@thinkrank/shared$': '<rootDir>/../../shared/types/src',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  testTimeout: 30000,
};