import { expect, test } from "@playwright/test";

const docsURL = process.env.E2E_DOCS_URL!;
const webURL = process.env.E2E_WEB_URL!;

test("the removed authenticated API reference has no replacement route", async ({ request }) => {
  const response = await request.get(new URL("/api-docs", webURL).toString(), {
    maxRedirects: 0,
  });
  expect(response.status()).toBe(404);
});

test("public docs serve the static API reference and developer guides", async ({
  page,
  request,
}) => {
  const schema = await request.get(new URL("/openapi.json", docsURL).toString());
  expect(schema.ok()).toBeTruthy();
  expect((await schema.json()).servers).toEqual([{ url: expect.stringMatching(/\/v1$/) }]);

  await page.goto(new URL("/docs/api", docsURL).toString());
  await expect(page.getByRole("heading", { name: "REST API reference" })).toBeVisible();
  await expect(page.getByText("does not execute requests from this site")).toBeVisible();
  await expect(page.getByRole("button", { name: /send|execute|try it/i })).toHaveCount(0);

  await page.locator("article a[href='/docs/api/auth']").first().click();
  await expect(page).toHaveURL(/\/docs\/api\/auth$/);
  await expect(page.getByText("X-API-Key").first()).toBeVisible();

  await page.goto(new URL("/docs/developer/quickstart", docsURL).toString());
  await expect(page.getByRole("heading", { name: "Developer quickstart" })).toBeVisible();
  await page.goto(new URL("/docs/developer/mcp", docsURL).toString());
  await expect(page.getByText("The public MCP guide is in development.")).toBeVisible();
});
