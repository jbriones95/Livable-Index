import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

const sharedNoUnusedVars = ['error', {
  varsIgnorePattern: '^[A-Z_]',
  argsIgnorePattern: '^_',
  caughtErrors: 'none',
}]

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['src/**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        process: 'readonly',
      },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': sharedNoUnusedVars,
    },
  },
  {
    files: ['tools/**/*.js', 'vite.config.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: {
        ...globals.node,
        fetch: 'readonly',
      },
      parserOptions: {
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': sharedNoUnusedVars,
    },
  },
])
