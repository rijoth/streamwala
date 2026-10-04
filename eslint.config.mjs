import tseslint from 'typescript-eslint';
import noRawKeyListeners from './eslint-rules/no-raw-key-listeners.mjs';

/**
 * Flat ESLint config. Intentionally minimal: it only enforces the guardrail
 * rules, not a general style ruleset, so it cannot be used to weaken anything.
 */
export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'playwright-report/**', 'test-results/**'],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      aether: { rules: { 'no-raw-key-listeners': noRawKeyListeners } },
    },
    rules: {
      'aether/no-raw-key-listeners': 'error',
      // JSX key handlers may only live in the allow-listed text-input primitives.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXAttribute[name.name=/^onKey(Down|Up|Press)$/]',
          message:
            'JSX key handlers are only allowed in shared text-input primitives. Route keyboard input through src/shared/input.',
        },
      ],
    },
  },
  {
    // The only two files permitted to own raw keyboard concerns.
    files: ['src/shared/input/useTvInput.ts', 'src/shared/ui/TextField.tsx'],
    rules: {
      'aether/no-raw-key-listeners': 'off',
      'no-restricted-syntax': 'off',
    },
  },
];
