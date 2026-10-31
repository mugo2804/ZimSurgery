import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;

// Runs against its own server, database (.data/e2e) and build folder, so it never touches
// your dev data or a running `npm run dev`.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: {
    command: `rm -rf .data/e2e && npx tsx --conditions=react-server scripts/migrate.ts && npx tsx --conditions=react-server src/server/db/seed.ts && npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { PGLITE_DIR: '.data/e2e', NEXT_DIST_DIR: '.next-e2e', BETTER_AUTH_URL: `http://localhost:${PORT}`, ENFORCE_2FA: 'false', SCHEDULER: 'off' },
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, dependencies: ['setup'], testIgnore: /auth\.setup\.ts/ },
  ],
});
