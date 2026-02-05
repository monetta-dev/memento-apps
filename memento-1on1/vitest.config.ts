import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: [
      '**/*.{test,spec}.{js,jsx,ts,tsx}',
      '**/__tests__/**/*.{js,jsx,ts,tsx}',
    ],
    exclude: [
      'node_modules',
      '.next',
      'playwright-report',
      'test-results',
      'tests/e2e/**/*', // E2E tests are handled by Playwright
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules',
        '.next',
        '**/*.d.ts',
        '**/*.config.*',
        '**/__tests__/**',
        'tests/**',
        'playwright.config.ts',
        'next.config.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
    },
  },
});