/**
 * Jest Configuration for London School TDD
 * Emphasizes extensive mocking and behavior verification
 */

module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // File patterns
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/*.test.ts',
    '**/*.spec.ts'
  ],
  
  // TypeScript support
  preset: 'ts-jest',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  
  // Module resolution
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@shared/(.*)$': '<rootDir>/../shared/src/$1',
  },
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup/jest.setup.ts',
    '<rootDir>/tests/setup/mocks.setup.ts'
  ],
  
  // Coverage configuration - London School emphasis on interaction coverage
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.types.ts',
    '!src/**/index.ts',
    // Focus on business logic, not infrastructure
    '!src/infrastructure/**',
    '!src/config/**',
  ],
  
  // High coverage thresholds for business logic
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    // Higher thresholds for core business logic
    'src/services/**': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    'src/controllers/**': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },
  
  // Coverage reporting
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json-summary',
    'cobertura', // For CI/CD integration
  ],
  
  // Coverage directory
  coverageDirectory: 'coverage',
  
  // Mock configuration for London School approach
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  
  // Automatic mocking of modules
  automock: false, // We'll manually mock for better control
  
  // Mock patterns
  modulePathIgnorePatterns: [
    '<rootDir>/dist/',
    '<rootDir>/node_modules/',
  ],
  
  // Test timeout for async operations
  testTimeout: 10000,
  
  // Verbose output for better debugging
  verbose: true,
  
  // Error reporting
  errorOnDeprecated: true,
  
  // Test result processor for custom reporting
  testResultsProcessor: '<rootDir>/tests/processors/results-processor.js',
  
  // Custom matchers for London School testing
  setupFilesAfterEnv: [
    '<rootDir>/tests/matchers/custom-matchers.ts'
  ],
  
  // Global test configuration
  globals: {
    'ts-jest': {
      useESM: false,
      tsconfig: {
        compilerOptions: {
          module: 'commonjs',
          target: 'es2020',
          lib: ['es2020'],
          moduleResolution: 'node',
          allowSyntheticDefaultImports: true,
          esModuleInterop: true,
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
          resolveJsonModule: true,
        },
      },
    },
  },
  
  // Performance optimization
  maxWorkers: '50%',
  
  // Watch mode configuration
  watchPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/coverage/',
  ],
  
  // Test environment options
  testEnvironmentOptions: {
    url: 'http://localhost',
  },
  
  // Snapshot configuration
  snapshotSerializers: [
    '<rootDir>/tests/serializers/error-serializer.js'
  ],
  
  // Transform ignore patterns
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$))',
  ],
  
  // Custom reporters for detailed output
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './coverage/html-report',
        filename: 'report.html',
        expand: true,
        hideIcon: false,
        pageTitle: 'London School TDD Test Results',
      },
    ],
    [
      'jest-junit',
      {
        outputDirectory: './coverage',
        outputName: 'junit.xml',
        suiteName: 'London School Unit Tests',
        includeConsoleOutput: true,
      },
    ],
  ],
  
  // Custom test environment for enhanced mocking
  projects: [
    {
      displayName: 'unit-tests',
      testMatch: ['<rootDir>/src/**/*.test.ts'],
      testEnvironment: 'node',
    },
    {
      displayName: 'integration-tests',
      testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/tests/setup/integration.setup.ts'],
    },
  ],
};