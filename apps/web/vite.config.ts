import { fileURLToPath, URL } from 'node:url';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// One .env at the repo root serves both apps.
const envDir = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig(({ mode }) => ({
  envDir,
  plugins: [
    // The router plugin must come before the React plugin.
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    // React Compiler through Babel (ADR-0004).
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    proxy: {
      '/api':
        loadEnv(mode, envDir, '').API_PROXY_TARGET || 'http://localhost:3000',
    },
  },
}));
