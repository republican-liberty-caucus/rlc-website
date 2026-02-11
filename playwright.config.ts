import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['json', { outputFile: 'test-results.json' }]],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: /demo-walkthrough/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'demo',
      testMatch: /demo-walkthrough/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        video: {
          mode: 'on',
          size: { width: 1920, height: 1080 },
        },
        launchOptions: { slowMo: 50 },
      },
    },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 30000,
      },
});
