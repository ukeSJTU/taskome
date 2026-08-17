import { createHash, randomUUID } from "node:crypto";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { expect, test, type Page } from "@playwright/test";

const password = "browser-e2e-password";

async function expectOK(response: import("@playwright/test").APIResponse) {
  expect(response.ok(), `HTTP ${response.status()} creating the disposable test user`).toBeTruthy();
}

function address(label: string) {
  return `${label}-${randomUUID()}@e2e.taskome.test`;
}

async function waitForClientForm(page: Page) {
  const passwordInput = page.getByLabel("Password", { exact: true });
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(passwordInput).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Hide password" }).click();
  await expect(passwordInput).toHaveAttribute("type", "password");
}

async function signUp(page: Page, name: string, email: string) {
  await page.goto("/en/signup");
  await waitForClientForm(page);
  await page.getByLabel("Full Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("anonymous dashboard access redirects to sign-in", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/en\/login$/);
  await expect(page.getByRole("heading", { name: "Login to your account" })).toBeVisible();
});

test("public pages preserve the pathname while switching languages", async ({ page }) => {
  await page.goto("/en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "We design the molecule that binds — not the one that merely predicts.",
    }),
  ).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/en$/);
  await expect(page.locator('link[rel="alternate"][hreflang="zh-CN"]')).toHaveAttribute(
    "href",
    process.env.E2E_WEB_URL!,
  );

  await page.getByRole("link", { name: "切换到中文" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(
    page.getByRole("heading", { level: 1, name: "我们设计真正能够结合的分子，而不止于预测。" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "关于我们", exact: true }).click();
  await expect(page).toHaveURL(/\/about$/);
  await page.getByRole("link", { name: "切换到英文" }).click();
  await expect(page).toHaveURL(/\/en\/about$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("a new user signs up and sees their identity", async ({ page }) => {
  const email = address("signup");
  await signUp(page, "Browser Signup", email);
  await expect(page.getByText("Browser Signup", { exact: true })).toBeVisible();
  await expect(page.getByText(email, { exact: true })).toBeVisible();
});

test("a returning user signs in and sees their identity", async ({ page, request }) => {
  const email = address("signin");
  const signup = await request.post("/api/auth/sign-up/email", {
    data: { email, name: "Browser Signin", password },
  });
  await expectOK(signup);
  await page.goto("/en/login");
  await waitForClientForm(page);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Browser Signin", { exact: true })).toBeVisible();
});

test("an authenticated user opens a local PDB in the Structure Viewer", async ({ page }) => {
  await signUp(page, "Structure Viewer", address("structure-viewer"));
  const publicStructureRequest = page
    .waitForRequest((request) => /rcsb|pdbe|alphafold|modelarchive|emdb/i.test(request.url()), {
      timeout: 1_000,
    })
    .catch(() => undefined);

  await page.goto("/viewers/structure");
  await page.locator('input[type="file"]').setInputFiles("e2e/fixtures/alanine.pdb");
  await expect(page.getByRole("status")).toHaveText("Structure ready", { timeout: 30_000 });
  await expect(page.locator("canvas").first()).toBeVisible();
  await page.getByLabel("Representation").selectOption("cartoon");
  await page.getByLabel("Coloring").selectOption("element");
  await page.getByRole("button", { name: "Reset camera" }).click();
  await expect(publicStructureRequest).resolves.toBeUndefined();
});

test("API Docs loads the live Gateway REST contract through the BFF", async ({ page }) => {
  const email = address("docs");
  const signup = await page.context().request.post("/api/auth/sign-up/email", {
    data: { email, name: "Browser Docs", password },
  });
  await expectOK(signup);
  const openAPIResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/gateway/openapi" && response.ok(),
  );
  await page.goto("/api-docs");
  await expect(page.getByRole("heading", { name: "API Docs" }).first()).toBeVisible();
  const openAPI = (await openAPIResponse).json() as Promise<{ paths: Record<string, unknown> }>;
  await expect(openAPI).resolves.toHaveProperty("paths./input-files");
});
test("MCP Agent completes PKCE onboarding and lists Gateway tools", async ({ page, request }) => {
  const callback = new URL("/dashboard", process.env.E2E_WEB_URL).toString();
  const state = randomUUID();
  const verifier = `e2e-${randomUUID()}-pkce-verifier`;
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const registration = await request.post("/api/auth/oauth2/register", {
    data: {
      client_name: "Taskome Browser E2E Agent",
      grant_types: ["authorization_code"],
      redirect_uris: [callback],
      response_types: ["code"],
      scope: "taskome",
      token_endpoint_auth_method: "none",
      type: "native",
    },
  });
  expect(registration.ok()).toBeTruthy();
  const { client_id: clientId } = (await registration.json()) as { client_id: string };
  const authorize = new URL("/api/auth/oauth2/authorize", process.env.E2E_WEB_URL);
  authorize.search = new URLSearchParams({
    client_id: clientId,
    code_challenge: challenge,
    code_challenge_method: "S256",
    redirect_uri: callback,
    response_type: "code",
    scope: "taskome",
    state,
  }).toString();
  await page.goto(authorize.toString());
  await waitForClientForm(page);
  const email = address("mcp");
  const signup = await request.post("/api/auth/sign-up/email", {
    data: { email, name: "MCP Browser User", password },
  });
  await expectOK(signup);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(
    page.getByRole("heading", { name: new RegExp(`Authorize ${clientId}`) }),
  ).toBeVisible();
  const callbackNavigation = page.waitForURL(callback + "?*");
  await page.getByRole("button", { name: "Allow" }).click();
  await callbackNavigation;
  const redirected = new URL(page.url());
  expect(redirected.searchParams.get("state")).toBe(state);
  const code = redirected.searchParams.get("code");
  expect(code).toBeTruthy();
  const token = await request.post("/api/auth/oauth2/token", {
    form: {
      client_id: clientId,
      code: code!,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: callback,
    },
    headers: { Origin: process.env.E2E_WEB_URL! },
  });
  expect(token.ok(), `token exchange failed: ${token.status()} ${await token.text()}`).toBeTruthy();
  const { access_token: accessToken } = (await token.json()) as { access_token: string };
  const client = new Client({ name: "taskome-browser-e2e", version: "1" });
  const transport = new StreamableHTTPClientTransport(
    new URL("/mcp/", process.env.E2E_GATEWAY_URL),
    {
      requestInit: { headers: { Authorization: `Bearer ${accessToken}` } },
    },
  );
  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining(["prepare_input_file_upload", "prepare_input_file_download"]),
    );
  } finally {
    await client.close();
  }
});
