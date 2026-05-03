import pluginJs from '@eslint/js';
import pluginTypescript from '@typescript-eslint/eslint-plugin';
import { parseForESLint } from '@typescript-eslint/parser';
import configPrettier from 'eslint-config-prettier';
import pluginPrettier from 'eslint-plugin-prettier';
import pluginUnusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  // Ignore patterns (e.g., dist folder)
  {
    ignores: ['dist/**'], // Explicitly ignore dist folder
  },
  // Global settings (e.g., for Node.js environment)
  {
    languageOptions: {
      globals: {
        ...globals.node, // Adjust for Node.js environment if applicable
      },
    },
  },
  // ESLint recommended rules for JavaScript
  pluginJs.configs.recommended,
  // TypeScript plugin to support TypeScript files
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: { parseForESLint },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': pluginTypescript,
      'unused-imports': pluginUnusedImports,
    },
    rules: {
      // '@typescript-eslint/explicit-module-boundary-types': 'warn',
      '@typescript-eslint/no-explicit-any': 'off', // Adjust as per your preference
      'unused-imports/no-unused-imports': 'error', // Automatically remove unused imports
      //'@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'off', // Automatically fix and remove unused variables
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: true,
          varsIgnorePattern: '^_', // Ignore variables prefixed with _
          argsIgnorePattern: '^_', // Ignore function arguments prefixed with _
        },
      ],
    },
  },
  // Prettier plugin to report Prettier issues as ESLint issues
  {
    plugins: {
      prettier: pluginPrettier,
    },
    rules: {
      'prettier/prettier': 'error',
      'no-unused-vars': 'off',
      'no-console': 'off',
      'no-unsafe-optional-chaining': 'off',
      'no-undef': 'off',
      eqeqeq: 'warn',
      indent: ['error', 2],
      quotes: ['error', 'single'],
      semi: ['error', 'always'],
      'no-implicit-globals': 'error',
      curly: ['error', 'all'],
      //'consistent-return': 'error',
      //'arrow-body-style': ['error', 'as-needed'],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  // Prettier configuration to disable conflicting ESLint rules
  configPrettier,
];
