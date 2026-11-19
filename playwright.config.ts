import { defineConfig, devices } from '@playwright/test';
import { ENV } from './src/config/env';

// Suppress Node.js punycode deprecation warning from mongodb driver
process.removeAllListeners('warning');

const isCI = !!process.env.CI;

export default defineConfig({
  globalSetup: './src/config/global-setup.ts',
  testDir: './tests',
  // Generous ceiling for live streaming automotive backend APIs
  timeout: 120_000,
  expect: {
    timeout: 15_000,
  },
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  fullyParallel: !isCI,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
    ['json', { outputFile: 'results.json' }],
    ...(isCI ? [['github'] as const] : []),
  ],
  use: {
    baseURL: ENV.baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    headless: true,
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
    // Unthrottle Chromium: Force 100% CPU speed matching manual browser
    launchOptions: {
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        // Critical: Prevent Chromium from throttling timers & JS event loops
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--enable-features=NetworkService,NetworkServiceInProcess',
      ],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
