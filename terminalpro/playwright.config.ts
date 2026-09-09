import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
dotenv.config();

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./tests",
  testMatch: ["**/*.spec.ts", "**/*.spec.tsx"],
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: "html",
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL: `https://pro.openbb.${process.env.VITE_ENVIRONMENT}`,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",
  },
  /* Configure projects for major browsers */
  projects: [
    {
      name: "register",
      testMatch: /global\.setup\.ts/,
      teardown: "delete account",
    },
    {
      name: "delete account",
      testMatch: /global\.teardown\.ts/,
    },
    {
      name: "Google Chrome",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
        storageState: "playwright/.auth/user.json",
      },
      dependencies: ["register"],
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: "playwright/.auth/user.json" },
      dependencies: ["register"],
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: "npm run dev",
    url: "http://localhost:1420",
    reuseExistingServer: !process.env.CI,
  },
});
