import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import jsdocPlugin from 'eslint-plugin-jsdoc';
import unicornPlugin from 'eslint-plugin-unicorn';
import prettierPlugin from 'eslint-plugin-prettier';
import prettier from 'eslint-config-prettier';

export default [
  {
    ignores: ['dist/**/*', 'docs/**/*', 'snippets/**/*'],
  },
  js.configs.recommended,
  {
    plugins: {
      '@typescript-eslint': tsPlugin,
      jsdoc: jsdocPlugin,
      unicorn: unicornPlugin,
      prettier: prettierPlugin,
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
    },
  },
  {
    plugins: {
      jsdoc: jsdocPlugin,
    },
    rules: {
      ...jsdocPlugin.configs.recommended.rules,
      'jsdoc/tag-lines': ['warn', 'never'],
      'jsdoc/require-returns': 'off',
    },
  },
  {
    plugins: {
      unicorn: unicornPlugin,
    },
    rules: {
      ...unicornPlugin.configs.recommended.rules,
      'unicorn/prefer-at': 'off',
      'unicorn/no-typeof-undefined': 'off',
    },
  },
  prettier,
  {
    languageOptions: {
      ecmaVersion: 2018,
      sourceType: 'module',
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2018,
        sourceType: 'module',
      },
      globals: {
        node: true,
        es6: true,
        process: true,
        console: true,
        URL: true,
      },
    },
    files: ['**/*.js', '**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'error',
      'unicorn/no-reduce': 'off',
      'unicorn/prevent-abbreviations': 'off',
      'unicorn/no-process-exit': 'off',
      'unicorn/import-style': 'off',
      // Add these rules that were previously from node plugin
      'no-process-exit': 'off',
      'no-unpublished-import': [
        'off',
        {
          allowModules: ['vite', 'vitest'],
        },
      ],
      'jsdoc/no-undefined-types': 'off',
    },
  },
  {
    files: ['tests/fixtures/fake-bin.js', 'tests/fixtures/fake-bin-with-env.js'],
    rules: {
      shebang: 'off',
    },
  },
];
