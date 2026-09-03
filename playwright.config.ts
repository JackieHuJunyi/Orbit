import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: true,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: "npm run start:e2e",
    url: "http://localhost:3000",
    // A production build replaces hashed assets. Reusing an older local
    // server after that replacement serves stale HTML pointing at deleted
    // chunks and turns a deterministic test run into hydration noise.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
