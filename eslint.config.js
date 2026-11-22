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

const noPrismaClientImport = {
  regex: '/generated/prisma/',
  allowTypeImports: true,
  message: 'Routers and controllers reach the database only through a service (ADR-0010).',
};
const noDbImport = {
  regex: '/lib/db(\\.js)?$',
  allowTypeImports: true,
  message: 'Routers and controllers reach the database only through a service (ADR-0010).',
};
const noExpressImport = {
  name: 'express',
  allowTypeImports: true,
  message: 'Services and data functions know nothing about HTTP (ADR-0010).',
};
const noCrossFolderRelativeImport = {
  regex: '^\\.\\.?/[^/]+/|^\\.\\./',
  message: "Import from another folder through '#src/…' or '#test/…'. Only same-folder imports use './'.",
};
function noApiLayerImport(layer) {
  return {
    regex: `-${layer}(\\.js)?$`,
    allowTypeImports: true,
    message: `This layer cannot import a ${layer} file (ADR-0010).`,
  };
}

export default defineConfig([
  globalIgnores(['**/dist', '**/routeTree.gen.ts', '**/coverage', '**/generated']),
  { linterOptions: { noInlineConfig: true } },
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
    files: ['apps/api/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        { patterns: [noCrossFolderRelativeImport] },
      ],
    },
  },
  {
    files: [
      'apps/api/src/features/**/*-router.ts',
      'apps/api/src/features/**/*-controller.ts',
      'apps/api/src/features/**/require-*.ts',
    ],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            noCrossFolderRelativeImport,
            noPrismaClientImport,
            noDbImport,
            noApiLayerImport('data'),
          ],
        },
      ],
    },
  },
  {
    files: ['apps/api/src/features/**/*-service.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [noExpressImport],
          patterns: [
            noCrossFolderRelativeImport,
            noApiLayerImport('controller'),
            noApiLayerImport('router'),
          ],
        },
      ],
    },
  },
  {
    files: ['apps/api/src/features/**/*-data.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [noExpressImport],
          patterns: [
            noCrossFolderRelativeImport,
            ...['service', 'controller', 'router'].map(noApiLayerImport),
          ],
        },
      ],
    },
  },
  {
    files: ['apps/api/src/lib/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            noCrossFolderRelativeImport,
            {
              ...noFeaturesImport,
              message: 'lib/ holds infrastructure with no glossary concept, so it cannot import from features/.',
            },
          ],
        },
      ],
    },
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
