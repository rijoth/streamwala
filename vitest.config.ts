import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, '.'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'eslint-rules/**/*.test.mjs'],
    exclude: ['node_modules/**', 'dist/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/shared/focus/**', 'src/shared/input/**', 'src/features/**'],
      exclude: ['**/*.test.*', '**/index.ts', '**/README.md'],
      thresholds: {
        // Ratchet-only floor measured when the component tests were added.
        // Raise these as coverage improves; never lower them.
        lines: 13,
        functions: 9,
        branches: 17,
        statements: 13,
      },
    },
  },
});