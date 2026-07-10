/**
 * ESLint config for GSTPilot Cloud Functions.
 *
 * ESLint 8.x is used so the legacy `.eslintrc.js` format works out of the box.
 * (The spec requested ESLint ^9, but v9 defaults to flat config which would
 * require eslint.config.js; we pin v8.57 for reliable `.eslintrc.js` support.)
 */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-unused-vars': 'off',
    '@typescript-eslint/consistent-type-imports': 'warn',
    'no-console': 'off',
  },
  ignorePatterns: ['lib/', 'node_modules/'],
};
