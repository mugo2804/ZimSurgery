import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      'server-only': path.resolve(import.meta.dirname, 'tests/server-only-stub.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    pool: 'forks',
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      DATABASE_URL: 'pglite://memory',
      // Fixed, test-only keys
      FIELD_ENCRYPTION_KEYS: 'v1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=,v2:AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=',
      BETTER_AUTH_SECRET: 'test-secret-test-secret-test-secret-123',
      BETTER_AUTH_URL: 'http://localhost:3000',
      ENFORCE_2FA: 'true',
    },
  },
});
