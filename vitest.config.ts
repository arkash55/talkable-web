import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom', // ok for code that might touch window/localStorage later
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    css: false,
  },
});
