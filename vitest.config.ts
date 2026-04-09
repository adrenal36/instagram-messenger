import { defineConfig } from 'vitest/config';

// Two projects: node-env tests for main-process helpers (fs, path, os),
// and jsdom-env tests for preload helpers that touch the DOM.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'main',
          environment: 'node',
          include: ['test/main/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'preload',
          environment: 'jsdom',
          include: ['test/preload/**/*.test.ts'],
        },
      },
    ],
  },
});
