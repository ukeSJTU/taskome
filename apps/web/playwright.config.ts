import { defineConfig, devices } from "@playwright/test";

const inCI = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";
const webURL = process.env.E2E_WEB_URL ?? "http://127.0.0.1:3100";
const gatewayURL = process.env.E2E_GATEWAY_URL ?? "http://127.0.0.1:8100";
const docsURL = process.env.E2E_DOCS_URL ?? "http://127.0.0.1:3001";
const webPort = new URL(webURL).port;
const gatewayPort = new URL(gatewayURL).port;
const docsPort = new URL(docsURL).port;
const production = process.env.E2E_PRODUCTION === "1";
const prebuilt = process.env.E2E_PREBUILT === "1";
const docsEnvironment = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
);

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
        ? `${prebuilt ? "" : "pnpm build && "}mkdir -p .next/standalone/apps/web/.next .next/standalone/apps/web/public && cp -R .next/static .next/standalone/apps/web/.next/static && cd .next/standalone && HOSTNAME=localhost PORT=${webPort} node apps/web/server.js`
        : `pnpm dev --port ${webPort}`,
      cwd: ".",
      env: { ...process.env, DATABASE_URL: process.env.E2E_WEB_DATABASE_URL! },
      reuseExistingServer: false,
      timeout: 180_000,
      url: `${webURL}/login`,
    },
    {
      command: `uv run uvicorn gateway.main:app --host 127.0.0.1 --port ${gatewayPort}`,
      cwd: "../gateway",
      env: { ...process.env, APP_ENVIRONMENT: production ? "production" : "development" },
      reuseExistingServer: false,
      url: `${gatewayURL}/health/ready`,
    },
    {
      command: production
        ? `${prebuilt ? "" : "pnpm build && "}pnpm start --port ${docsPort}`
        : `pnpm dev --port ${docsPort}`,
      cwd: "../docs",
      env: docsEnvironment,
      reuseExistingServer: false,
      url: `${docsURL}/docs/api`,
    },
  ],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
