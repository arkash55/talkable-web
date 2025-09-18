import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://127.0.0.1:3000', // matches your running server
    headless: true,
  },
//   // Option A: comment this whole block out during manual runs
//   webServer: {
//     command: 'next dev -p 3000',
//     url: 'http://127.0.0.1:3000',
//     reuseExistingServer: true,
//     timeout: 180_000,
//   },
  projects: [{ name: 'Chromium', use: { ...devices['Desktop Chrome'] } }],
});
