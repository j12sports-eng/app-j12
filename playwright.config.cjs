const path = require("node:path");
const { defineConfig, devices } = require("@playwright/test");

const artifacts = path.resolve(__dirname, "artifacts/e2e/playwright");

module.exports = defineConfig({
  testDir: "./e2e/sprint-23-11",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  outputDir: path.join(artifacts, "test-results"),
  reporter: [
    ["line"],
    ["json", { outputFile: path.join(artifacts, "results.json") }],
    ["html", { outputFolder: path.join(artifacts, "html"), open: "never" }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://127.0.0.1:3000",
    browserName: "chromium",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ignoreHTTPSErrors: false,
  },
  projects: [{ name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } }],
});
