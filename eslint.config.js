import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const reactHooksRecommended = reactHooks.configs.flat.recommended;

export default defineConfig([
  globalIgnores(['**/dist', '**/routeTree.gen.ts', '**/coverage', '**/generated']),
  js.configs.recommended,
  tseslint.configs.strict,
  {
    files: ['apps/api/**/*.ts', 'packages/**/*.ts', '*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    ...reactHooksRecommended,
    languageOptions: { globals: globals.browser },
    rules: Object.fromEntries(
      Object.keys(reactHooksRecommended.rules).map((rule) => [rule, 'error']),
    ),
  },
]);
