import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig(({ mode }) => ({
  test: {
    env: loadEnv(mode, repoRoot, ''),
    globalSetup: ['./test/global-setup.ts'],
    setupFiles: ['./test/truncate-tables.ts'],
    fileParallelism: false,
    maxWorkers: 1,
    hookTimeout: 30_000,
  },
}));
