import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const envFile = new URL('../../.env', import.meta.url);
if (existsSync(envFile)) process.loadEnvFile(envFile);

const isolated = process.env.E2E_ISOLATED === 'true';
const apiPort = isolated ? 3200 : 3000;
const webPort = isolated ? 5273 : 5173;
const anthropicStubPort = isolated ? 3201 : 3001;
const reuseExistingServer = !process.env.CI && !isolated;

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
      command: 'node e2e/anthropic-stub.ts',
      url: `http://localhost:${anthropicStubPort}/health`,
      env: { ANTHROPIC_STUB_PORT: String(anthropicStubPort) },
      reuseExistingServer,
    },
    {
      command: 'pnpm --filter @rota-ready/api dev',
      url: `http://localhost:${apiPort}/api/health`,
      env: {
        PORT: String(apiPort),
        WEB_URL: `http://localhost:${webPort}`,
        ANTHROPIC_API_KEY: 'stub-key',
        ANTHROPIC_BASE_URL: `http://localhost:${anthropicStubPort}`,
      },
      reuseExistingServer,
    },
    {
      command: `pnpm --filter @rota-ready/web exec vite --port ${webPort} --strictPort`,
      url: `http://localhost:${webPort}`,
      env: { API_PROXY_TARGET: `http://localhost:${apiPort}` },
      reuseExistingServer,
    },
  ],
});
