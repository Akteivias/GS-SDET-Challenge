import { defineConfig } from '@playwright/test';
/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [['list'], ['html']],

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'dev',
      use: {
        baseURL: 'http://localhost:3000/dev/',
      },
    },
    {
      name: 'prod',
      use: {
        baseURL: 'http://localhost:3000/prod/',
      },
      testIgnore: ['**/environment-isolation.spec.ts'],
    },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
