import js from '@eslint/js';
import i18next from 'eslint-plugin-i18next';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const reactHooksRecommended = reactHooks.configs.flat.recommended;

const noRoutesImport = {
  regex: '(^@/|/)routes/',
  message: 'Nothing imports from routes/. Move shared code into a feature, components/ or lib/.',
};
const noFeaturesImport = {
  regex: '(^@/|/)features/',
  message: 'components/ and lib/ hold app-wide code with no glossary concept, so they cannot import from features/.',
};

export default defineConfig([
  globalIgnores(['**/dist', '**/routeTree.gen.ts', '**/coverage', '**/generated']),
  js.configs.recommended,
  tseslint.configs.strict,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
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
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: [noRoutesImport] }] },
  },
  // A later block's no-restricted-imports replaces an earlier one, so the next two repeat noRoutesImport.
  {
    files: ['apps/web/src/routes/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [noRoutesImport, { ...noRoutesImport, regex: '^\\.\\.?/' }] },
      ],
    },
  },
  {
    files: ['apps/web/src/components/**/*.{ts,tsx}', 'apps/web/src/lib/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [noRoutesImport, noFeaturesImport] }],
    },
  },
  {
    files: ['apps/web/src/**/*.tsx'],
    ignores: ['apps/web/src/components/ui/**'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': [
        'error',
        {
          mode: 'jsx-only',
          callees: { exclude: ['t', 'register'] },
          'jsx-attributes': {
            include: [
              'alt',
              'title',
              'placeholder',
              'label',
              'aria-label',
              'aria-description',
              'aria-placeholder',
              'aria-roledescription',
              'aria-valuetext',
            ],
          },
        },
      ],
    },
  },
]);
