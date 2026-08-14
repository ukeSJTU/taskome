import { defineConfig, devices } from "@playwright/test";

const inCI = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";
const webURL = process.env.E2E_WEB_URL ?? "http://127.0.0.1:3100";
const gatewayURL = process.env.E2E_GATEWAY_URL ?? "http://127.0.0.1:8100";
const webPort = new URL(webURL).port;
const gatewayPort = new URL(gatewayURL).port;
const production = process.env.E2E_PRODUCTION === "1";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: !inCI,
  forbidOnly: inCI,
  failOnFlakyTests: inCI,
  retries: inCI ? 1 : 0,
  workers: inCI ? 1 : undefined,
  reporter: inCI ? [["github"], ["html", { open: "never" }]] : "list",
  outputDir: "test-results",
  use: {
    baseURL: webURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: production
        ? `pnpm build && mkdir -p .next/standalone/apps/web && cp -R .next/static .next/standalone/apps/web/.next/static && cp -R public .next/standalone/apps/web/public && cd .next/standalone && HOSTNAME=127.0.0.1 PORT=${webPort} node apps/web/server.js`
        : `pnpm dev --port ${webPort}`,
      cwd: ".",
      env: { ...process.env, DATABASE_URL: process.env.E2E_WEB_DATABASE_URL! },
      reuseExistingServer: false,
      url: `${webURL}/login`,
    },
    {
      command: `uv run uvicorn gateway.main:app --host 127.0.0.1 --port ${gatewayPort}`,
      cwd: "../gateway",
      env: { ...process.env, APP_ENVIRONMENT: production ? "production" : "development" },
      reuseExistingServer: false,
      url: `${gatewayURL}/health/ready`,
    },
  ],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
