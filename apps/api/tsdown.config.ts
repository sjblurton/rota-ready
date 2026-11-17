import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/server.ts'],
  platform: 'node',
  format: 'esm',
  // Workspace packages ship TypeScript source, so bundle them into the output.
  deps: { alwaysBundle: [/^@rota-ready\//] },
});
