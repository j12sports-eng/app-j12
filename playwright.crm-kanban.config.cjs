const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./e2e/crm-kanban",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 30_000 },
  outputDir: "artifacts/e2e/crm-kanban/test-results",
  reporter: [["line"], ["json", { outputFile: "artifacts/e2e/crm-kanban/results.json" }]],
  use: {
    baseURL: "http://127.0.0.1:3018",
    trace: "retain-on-failure",
    screenshot: "on",
    video: "off",
  },
  projects: [
    {
      name: "chromium-desktop",
      testMatch: /.*\.(desktop|keyboard|sla|sla-alerts)\.spec\.cjs/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium-touch",
      testMatch: /.*\.touch\.spec\.cjs/,
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    command: "npm run dev:web -- --host 127.0.0.1 --port 3018 --strictPort",
    url: "http://127.0.0.1:3018/login",
    reuseExistingServer: false,
    timeout: 120_000,
    env: { ...process.env, VITE_API_URL: "/api" },
  },
});
