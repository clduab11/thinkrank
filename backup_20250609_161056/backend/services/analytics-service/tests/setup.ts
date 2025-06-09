
// Test environment setup
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

// Mock Supabase client for tests
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: { id: 'test-id' }, error: null }))
        }))
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ error: null }))
      })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          gte: jest.fn(() => ({
            lte: jest.fn(() => Promise.resolve({ data: [], error: null }))
          }))
        })),
        gte: jest.fn(() => ({
          lte: jest.fn(() => Promise.resolve({ data: [], error: null }))
        })),
        in: jest.fn(() => ({
          gte: jest.fn(() => ({
            lte: jest.fn(() => Promise.resolve({ data: [], error: null }))
          }))
        })),
        order: jest.fn(() => ({
          limit: jest.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      }))
    }))
  }))
}));

// Mock winston logger
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    prettyPrint: jest.fn(),
    colorize: jest.fn(),
    simple: jest.fn()
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
}));

// Mock node-cron
jest.mock('node-cron', () => ({
  schedule: jest.fn()
}));

// Mock OS module
jest.mock('os', () => ({
  totalmem: jest.fn(() => 8589934592), // 8GB
  freemem: jest.fn(() => 4294967296), // 4GB
  cpus: jest.fn(() => [
    { times: { user: 1000, nice: 0, sys: 500, idle: 8000, irq: 0 } },
    { times: { user: 1000, nice: 0, sys: 500, idle: 8000, irq: 0 } }
  ]),
  loadavg: jest.fn(() => [0.5, 0.7, 0.9]),
  platform: jest.fn(() => 'linux'),
  arch: jest.fn(() => 'x64')
}));

// Test utilities
export const createMockRequest = (overrides: any = {}) => ({
  body: {},
  params: {},
  query: {},
  headers: {},
  ip: '127.0.0.1',
  get: jest.fn(() => 'test-user-agent'),
  ...overrides
});

export const createMockResponse = () => {
  const res: any = {
    status: jest.fn(() => res),
    json: jest.fn(() => res),
    send: jest.fn(() => res),
    set: jest.fn(() => res),
    setHeader: jest.fn(() => res)
  };
  return res;
};

export const createMockNext = () => jest.fn();

// Test data factories
export const createTestEvent = (overrides: any = {}) => ({
  userId: 'test-user-id',
  eventType: 'test_event',
  eventData: { test: 'data' },
  timestamp: new Date(),
  sessionId: 'test-session-id',
  ...overrides
});

export const createTestUser = (overrides: any = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  username: 'testuser',
  created_at: new Date().toISOString(),
  ...overrides
});

export const createTestAlert = (overrides: any = {}) => ({
  type: 'error_rate' as const,
  severity: 'high' as const,
  title: 'Test Alert',
  message: 'Test alert message',
  status: 'active' as const,
  ...overrides
});

// Clean up after tests
afterEach(() => {
  jest.clearAllMocks();
});

beforeEach(() => {
  // Reset any test state
  jest.clearAllTimers();
});

// Global test timeout
jest.setTimeout(10000);
