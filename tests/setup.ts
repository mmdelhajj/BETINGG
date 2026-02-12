// ─── Test Setup ─────────────────────────────────────────
// Global test configuration for Vitest

import { beforeAll, afterAll, vi } from 'vitest';

// Mock Redis
vi.mock('../src/lib/redis', () => {
  const store = new Map<string, string>();
  return {
    redis: {
      get: vi.fn((key: string) => Promise.resolve(store.get(key) || null)),
      set: vi.fn((key: string, value: string) => { store.set(key, value); return Promise.resolve('OK'); }),
      setex: vi.fn((key: string, _ttl: number, value: string) => { store.set(key, value); return Promise.resolve('OK'); }),
      del: vi.fn((...keys: string[]) => { keys.forEach(k => store.delete(k)); return Promise.resolve(keys.length); }),
      incr: vi.fn((key: string) => {
        const val = parseInt(store.get(key) || '0', 10) + 1;
        store.set(key, String(val));
        return Promise.resolve(val);
      }),
      keys: vi.fn((_pattern: string) => Promise.resolve([])),
      pexpire: vi.fn(() => Promise.resolve(1)),
      expire: vi.fn(() => Promise.resolve(1)),
      ttl: vi.fn(() => Promise.resolve(-1)),
      pttl: vi.fn(() => Promise.resolve(-1)),
      multi: vi.fn(() => ({
        incr: vi.fn().mockReturnThis(),
        pttl: vi.fn().mockReturnThis(),
        exec: vi.fn(() => Promise.resolve([[null, 1], [null, -1]])),
      })),
      mget: vi.fn((..._keys: string[]) => Promise.resolve([])),
      _store: store,
    },
  };
});

// Clean up between tests
beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test_jwt_secret_key_for_testing_only';
});

afterAll(() => {
  vi.restoreAllMocks();
});
