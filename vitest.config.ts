// vitest.config.ts
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ['styled-jsx/babel'],
      },
    }),
    tsconfigPaths(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'http://localhost/', // stable URL for router/URLSearchParams code
      },
    },
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    css: true, // allow CSS imports in components
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: { provider: 'v8', reporter: ['text', 'html', 'lcov'] },
    // Optional niceties:
    // hookTimeout: 20000,
    // testTimeout: 20000,
    // reporters: 'default',
    // restoreMocks: true, // if you prefer Vitest to auto-restore spies between tests
  },
});
