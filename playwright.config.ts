import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4322",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command: "bun run build && bun run src/server/dev.ts",
      url: "http://127.0.0.1:4322",
      env: { PORT: "4322" },
      reuseExistingServer: false,
    },
    {
      command: "bun run tests/helpers/preview-server.ts",
      url: "http://127.0.0.1:4323",
      env: { PORT: "4323" },
      reuseExistingServer: false,
    },
  ],
});
