import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./test/global-setup.ts'],
    setupFiles: ['./test/truncate-tables.ts'],
    fileParallelism: false,
    maxWorkers: 1,
    hookTimeout: 30_000,
  },
});
