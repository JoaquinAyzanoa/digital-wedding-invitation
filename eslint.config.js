import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'supabase/.temp']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
  },
  {
    // Google Apps Script: classic script, Google services as globals, entry points called by
    // the trigger, by hand or by the web app (sync, setup, doGet, doPost) and helpers shared
    // with the tests.
    files: ['apps-script/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        SpreadsheetApp: 'readonly',
        PropertiesService: 'readonly',
        LockService: 'readonly',
        UrlFetchApp: 'readonly',
        ScriptApp: 'readonly',
        DriveApp: 'readonly',
        Utilities: 'readonly',
        ContentService: 'readonly',
        console: 'readonly',
        module: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^(sync|setup|setupAlbum|doGet|doPost)$' }],
    },
  },
  prettier,
]);
