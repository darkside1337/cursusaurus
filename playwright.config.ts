import fs from "node:fs";
import { defineConfig, devices } from "@playwright/test";

if (fs.existsSync(".env")) {
  process.loadEnvFile(".env");
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  timeout: 60 * 1000,
  workers: 2,
  reporter: process.env.CI ? "github" : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    channel: "chrome",
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROME_PATH || "/home/darkside/.local/bin/google-chrome",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
  webServer: {
    command: "pnpm build && pnpm start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180 * 1000,
    env: {
      STRIPE_WEBHOOK_SECRET:
        process.env.STRIPE_WEBHOOK_SECRET || "whsec_test_secret_for_local_testing",
    },
  },
});
