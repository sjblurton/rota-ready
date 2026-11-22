import { defineConfig, devices } from '@playwright/test';
import { JOURNEY_NOW } from './e2e/journey-clock';
import { apiPort, webPort } from './e2e/journey-servers';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${webPort}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter @rota-ready/api journey-server',
      url: `http://localhost:${apiPort}/api/health`,
      env: {
        PORT: String(apiPort),
        WEB_URL: `http://localhost:${webPort}`,
        JOURNEY_NOW,
      },
      reuseExistingServer: false,
    },
    {
      command: `pnpm --filter @rota-ready/web exec vite --port ${webPort} --strictPort`,
      url: `http://localhost:${webPort}`,
      env: { API_PROXY_TARGET: `http://localhost:${apiPort}` },
      reuseExistingServer: false,
    },
  ],
});
