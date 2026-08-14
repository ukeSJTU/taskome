import { createHash, randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

const password = "browser-e2e-password";

async function expectOK(response: import("@playwright/test").APIResponse) {
  expect(response.ok(), `HTTP ${response.status()} creating the disposable test user`).toBeTruthy();
}

function address(label: string) {
  return `${label}-${randomUUID()}@e2e.taskome.test`;
}

async function waitForClientForm(page: Page) {
  await expect(page.getByTestId("auth-form")).toHaveAttribute("data-hydrated", "true");
}

async function signUp(page: Page, name: string, email: string) {
  await page.goto("/signup");
  await waitForClientForm(page);
  await page.getByLabel("Full Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("anonymous dashboard access redirects to sign-in", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Login to your account" })).toBeVisible();
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
  await page.goto("/login");
  await waitForClientForm(page);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Browser Signin", { exact: true })).toBeVisible();
});

test("API Docs loads the live Gateway REST contract through the BFF", async ({ page, request }) => {
  const email = address("docs");
  const signup = await request.post("/api/auth/sign-up/email", {
    data: { email, name: "Browser Docs", password },
  });
  await expectOK(signup);
  await page.goto("/login");
  await waitForClientForm(page);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Login" }).click();
  await page.goto("/api-docs");
  await expect(page.getByRole("heading", { name: "API Docs" })).toBeVisible();
  await expect(page.getByText("Input Files", { exact: true })).toBeVisible();
});

test("MCP Agent completes PKCE onboarding and lists Gateway tools", async ({ page, request }) => {
  const callback = "http://127.0.0.1:9876/callback";
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
  const callbackNavigation = page.waitForURL(new RegExp("^http://127\\.0\\.0\\.1:9876/callback"));
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
  });
  expect(token.ok()).toBeTruthy();
  const { access_token: accessToken } = (await token.json()) as { access_token: string };
  const mcpURL = `${process.env.E2E_GATEWAY_URL}/mcp/`;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json, text/event-stream",
    "Content-Type": "application/json",
  };
  const initialized = await request.post(mcpURL, {
    headers,
    data: {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "browser-e2e", version: "1" },
      },
    },
  });
  expect(initialized.ok()).toBeTruthy();
  const session = initialized.headers()["mcp-session-id"];
  expect(session).toBeTruthy();
  if (!session) throw new Error("Gateway did not return an MCP session ID");
  const tools = await request.post(mcpURL, {
    headers: { ...headers, "mcp-session-id": session },
    data: { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
  });
  expect(tools.ok()).toBeTruthy();
  const result = (await tools.json()) as { result: { tools: Array<{ name: string }> } };
  expect(result.result.tools.map((tool) => tool.name)).toEqual(
    expect.arrayContaining(["prepare_input_file_upload", "prepare_input_file_download"]),
  );
});
