import { defineConfig } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'tests',
  testMatch: 'smoke.spec.js',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    browserName: 'chromium',
  },
  projects: [
    { name: 'phone-375', use: { viewport: { width: 375, height: 812 } } },
    { name: 'tablet-768', use: { viewport: { width: 768, height: 1024 } } },
  ],
  webServer: {
    command: 'node scripts/dev.mjs',
    env: { PORT: String(PORT) },
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
  },
});
