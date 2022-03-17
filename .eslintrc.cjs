module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'prettier', 'tsdoc'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:node/recommended',
    'plugin:unicorn/recommended',
    'prettier',
  ],
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  env: {
    browser: false,
    node: true,
    es6: true,
  },
  rules: {
    '@typescript-eslint/no-unused-vars': 'error',
    'unicorn/no-reduce': 'off',
    'unicorn/prevent-abbreviations': 'off',
    'unicorn/no-process-exit': 'off',
    'unicorn/import-style': 'off',
    'node/no-missing-import': 'off',
    'node/no-unsupported-features/es-syntax': [
      'error',
      {
        ignores: ['modules'],
      },
    ],
    'node/no-extraneous-import': ['error'],
    'node/no-unpublished-import': [
      'error',
      {
        allowModules: ['vite', 'vitest'],
      },
    ],
    'tsdoc/syntax': 'warn',
  },
  overrides: [
    {
      files: ['tests/fixtures/fake-bin.js', 'tests/fixtures/fake-bin-with-env.js'],
      rules: {
        'node/shebang': 'off',
      },
    },
  ],
};
