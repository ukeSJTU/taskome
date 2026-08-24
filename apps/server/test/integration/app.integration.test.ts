import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { createApp, type App } from "@/app";
import { createSessionResolver } from "@/auth/session";
import type { DatabaseRuntime } from "@/db/database";
import { createProjectsModule } from "@/features/projects";

const serverOrigin = "http://localhost:3000";
const webOrigin = "http://localhost:3001";

async function registerUser(app: App, email: string) {
  const response = await app.request(`${serverOrigin}/api/auth/sign-up/email`, {
    body: JSON.stringify({
      email,
      name: "Projects User",
      password: "correct horse battery staple",
    }),
    headers: {
      "content-type": "application/json",
      origin: webOrigin,
    },
    method: "POST",
  });
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];

  expect(response.status).toBe(200);
  expect(cookie).toBeTruthy();
  return cookie ?? "";
}

describe("server with PostgreSQL and Better Auth", () => {
  let app: App;
  let container: StartedPostgreSqlContainer;
  let database: DatabaseRuntime;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:18.4-alpine3.24")
      .withDatabase("taskome_test")
      .withPassword("taskome_test")
      .withUsername("taskome_test")
      .start();
    process.env.BETTER_AUTH_SECRET = "integration-test-secret-at-least-32-characters"; // gitleaks:allow
    process.env.BETTER_AUTH_URL = serverOrigin;
    process.env.CORS_ORIGIN = webOrigin;
    process.env.DATABASE_URL = container.getConnectionUri();
    process.env.NODE_ENV = "test";

    ({ database } = await import("@/db"));
    await migrate(database.db, {
      migrationsFolder: resolve(process.cwd(), "drizzle"),
    });

    const { auth } = await import("@/auth");
    app = createApp({
      authHandler: (request) => auth.handler(request),
      checkReadiness: database.check,
      corsOrigin: webOrigin,
      drain: () => undefined,
      getSession: createSessionResolver(auth),
      projects: createProjectsModule(database.db),
    });
  });

  afterAll(async () => {
    await database?.close();
    await container?.stop();
  });

  it("migrates from empty and creates an authenticated session", async () => {
    const email = "integration@example.com";
    const signUpResponse = await app.request(`${serverOrigin}/api/auth/sign-up/email`, {
      body: JSON.stringify({
        email,
        name: "Integration User",
        password: "correct horse battery staple",
      }),
      headers: {
        "content-type": "application/json",
        origin: webOrigin,
      },
      method: "POST",
    });
    const cookie = signUpResponse.headers.get("set-cookie")?.split(";", 1)[0];

    expect(signUpResponse.status).toBe(200);
    expect(cookie).toBeTruthy();

    const sessionResponse = await app.request(`${serverOrigin}/api/auth/get-session`, {
      headers: { cookie: cookie ?? "", origin: webOrigin },
    });

    expect(sessionResponse.status).toBe(200);
    expect(await sessionResponse.json()).toMatchObject({
      user: { email, name: "Integration User" },
    });
  });

  it("reports readiness through the migrated database", async () => {
    const response = await app.request("/readyz");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ready" });
  });

  it("gives a newly registered user one Default Project", async () => {
    const signUpResponse = await app.request(`${serverOrigin}/api/auth/sign-up/email`, {
      body: JSON.stringify({
        email: "projects@example.com",
        name: "Projects User",
        password: "correct horse battery staple",
      }),
      headers: {
        "content-type": "application/json",
        origin: webOrigin,
      },
      method: "POST",
    });
    const cookie = signUpResponse.headers.get("set-cookie")?.split(";", 1)[0];

    expect(signUpResponse.status).toBe(200);
    expect(cookie).toBeTruthy();

    const projectsResponse = await app.request(`${serverOrigin}/api/v1/projects`, {
      headers: {
        cookie: cookie ?? "",
        origin: webOrigin,
      },
    });

    expect(projectsResponse.status).toBe(200);
    expect(await projectsResponse.json()).toEqual({
      items: [
        {
          archivedAt: null,
          createdAt: expect.any(String),
          description: null,
          id: expect.any(String),
          isDefault: true,
          name: "Default Project",
          status: "active",
          updatedAt: expect.any(String),
        },
      ],
      nextCursor: null,
    });
  });

  it("creates and lists a normalized private Project", async () => {
    const cookie = await registerUser(app, "create-project@example.com");

    const createResponse = await app.request(`${serverOrigin}/api/v1/projects`, {
      body: JSON.stringify({
        description: "  Pocket detection candidates  ",
        name: "  Alpha  ",
      }),
      headers: {
        "content-type": "application/json",
        cookie,
        origin: webOrigin,
      },
      method: "POST",
    });

    expect(createResponse.status).toBe(201);
    expect(await createResponse.json()).toMatchObject({
      archivedAt: null,
      description: "Pocket detection candidates",
      id: expect.any(String),
      isDefault: false,
      name: "Alpha",
      status: "active",
    });

    const listResponse = await app.request(`${serverOrigin}/api/v1/projects`, {
      headers: { cookie, origin: webOrigin },
    });
    expect(listResponse.status).toBe(200);
    expect(await listResponse.json()).toMatchObject({
      items: [{ name: "Default Project" }, { name: "Alpha" }],
      nextCursor: null,
    });
  });

  it("rejects a normalized Project name conflict", async () => {
    const cookie = await registerUser(app, "project-conflict@example.com");
    const create = (name: string) =>
      app.request(`${serverOrigin}/api/v1/projects`, {
        body: JSON.stringify({ name }),
        headers: {
          "content-type": "application/json",
          cookie,
          origin: webOrigin,
        },
        method: "POST",
      });

    const initialResponse = await create("Straße");
    const { id } = z.object({ id: z.string() }).parse(await initialResponse.json());
    const archiveResponse = await app.request(`${serverOrigin}/api/v1/projects/${id}/archive`, {
      headers: { cookie, origin: webOrigin },
      method: "POST",
    });
    const conflictResponse = await create("  ＳＴＲＡＳＳＥ  ");

    expect(initialResponse.status).toBe(201);
    expect(archiveResponse.status).toBe(200);
    expect(conflictResponse.status).toBe(409);
    expect(await conflictResponse.json()).toMatchObject({
      code: "project_name_conflict",
      status: 409,
      title: "Project name already exists",
    });
  });

  it("rejects a blank Project name at the HTTP validation seam", async () => {
    const cookie = await registerUser(app, "project-validation@example.com");

    const response = await app.request(`${serverOrigin}/api/v1/projects`, {
      body: JSON.stringify({ name: "   " }),
      headers: {
        "content-type": "application/json",
        cookie,
        origin: webOrigin,
      },
      method: "POST",
    });

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      code: "validation_failed",
      status: 422,
    });
  });

  it("applies Project text limits by Unicode code point", async () => {
    const cookie = await registerUser(app, "project-unicode-length@example.com");
    const acceptedResponse = await app.request(`${serverOrigin}/api/v1/projects`, {
      body: JSON.stringify({
        description: "🧬".repeat(1000),
        name: "🧬".repeat(100),
      }),
      headers: {
        "content-type": "application/json",
        cookie,
        origin: webOrigin,
      },
      method: "POST",
    });
    const rejectedResponse = await app.request(`${serverOrigin}/api/v1/projects`, {
      body: JSON.stringify({ name: "🧬".repeat(101) }),
      headers: {
        "content-type": "application/json",
        cookie,
        origin: webOrigin,
      },
      method: "POST",
    });

    expect(acceptedResponse.status).toBe(201);
    expect(rejectedResponse.status).toBe(422);
  });

  it("paginates the stable Project ordering with an opaque cursor", async () => {
    const cookie = await registerUser(app, "project-pagination@example.com");
    const create = (name: string) =>
      app.request(`${serverOrigin}/api/v1/projects`, {
        body: JSON.stringify({ name }),
        headers: {
          "content-type": "application/json",
          cookie,
          origin: webOrigin,
        },
        method: "POST",
      });
    expect((await create("Beta")).status).toBe(201);
    expect((await create("Alpha")).status).toBe(201);

    const firstResponse = await app.request(`${serverOrigin}/api/v1/projects?limit=2`, {
      headers: { cookie, origin: webOrigin },
    });
    const first = z
      .object({
        items: z.array(z.object({ name: z.string() })).length(2),
        nextCursor: z.string(),
      })
      .parse(await firstResponse.json());
    const secondResponse = await app.request(
      `${serverOrigin}/api/v1/projects?limit=2&cursor=${encodeURIComponent(first.nextCursor)}`,
      { headers: { cookie, origin: webOrigin } },
    );

    expect(first.items.map((project) => project.name)).toEqual(["Default Project", "Alpha"]);
    expect(secondResponse.status).toBe(200);
    expect(await secondResponse.json()).toMatchObject({
      items: [{ name: "Beta" }],
      nextCursor: null,
    });
  });

  it("returns a Project only to its owner", async () => {
    const ownerCookie = await registerUser(app, "project-owner@example.com");
    const otherCookie = await registerUser(app, "project-other@example.com");
    const createResponse = await app.request(`${serverOrigin}/api/v1/projects`, {
      body: JSON.stringify({ name: "Private Project" }),
      headers: {
        "content-type": "application/json",
        cookie: ownerCookie,
        origin: webOrigin,
      },
      method: "POST",
    });
    const { id } = z.object({ id: z.string() }).parse(await createResponse.json());

    const ownerResponse = await app.request(`${serverOrigin}/api/v1/projects/${id}`, {
      headers: { cookie: ownerCookie, origin: webOrigin },
    });
    const otherResponse = await app.request(`${serverOrigin}/api/v1/projects/${id}`, {
      headers: { cookie: otherCookie, origin: webOrigin },
    });

    expect(ownerResponse.status).toBe(200);
    expect(await ownerResponse.json()).toMatchObject({ id, name: "Private Project" });
    expect(otherResponse.status).toBe(404);
    expect(await otherResponse.json()).toMatchObject({
      code: "project_not_found",
      status: 404,
      title: "Project not found",
    });
  });

  it("updates an active regular Project", async () => {
    const cookie = await registerUser(app, "project-update@example.com");
    const createResponse = await app.request(`${serverOrigin}/api/v1/projects`, {
      body: JSON.stringify({ description: "Initial", name: "Original" }),
      headers: {
        "content-type": "application/json",
        cookie,
        origin: webOrigin,
      },
      method: "POST",
    });
    const { id } = z.object({ id: z.string() }).parse(await createResponse.json());

    const updateResponse = await app.request(`${serverOrigin}/api/v1/projects/${id}`, {
      body: JSON.stringify({ description: null, name: "  Renamed  " }),
      headers: {
        "content-type": "application/json",
        cookie,
        origin: webOrigin,
      },
      method: "PATCH",
    });

    expect(updateResponse.status).toBe(200);
    expect(await updateResponse.json()).toMatchObject({
      description: null,
      id,
      name: "Renamed",
      status: "active",
    });
  });

  it("keeps the Default Project name immutable while allowing its description", async () => {
    const cookie = await registerUser(app, "default-project-update@example.com");
    const listResponse = await app.request(`${serverOrigin}/api/v1/projects`, {
      headers: { cookie, origin: webOrigin },
    });
    const { id } = z
      .object({ items: z.tuple([z.object({ id: z.string() })]) })
      .parse(await listResponse.json()).items[0];

    const renameResponse = await app.request(`${serverOrigin}/api/v1/projects/${id}`, {
      body: JSON.stringify({ name: "Renamed Default" }),
      headers: {
        "content-type": "application/json",
        cookie,
        origin: webOrigin,
      },
      method: "PATCH",
    });
    const describeResponse = await app.request(`${serverOrigin}/api/v1/projects/${id}`, {
      body: JSON.stringify({ description: "Fallback for unassigned work" }),
      headers: {
        "content-type": "application/json",
        cookie,
        origin: webOrigin,
      },
      method: "PATCH",
    });

    expect(renameResponse.status).toBe(409);
    expect(await renameResponse.json()).toMatchObject({
      code: "default_project_immutable",
      status: 409,
    });
    expect(describeResponse.status).toBe(200);
    expect(await describeResponse.json()).toMatchObject({
      description: "Fallback for unassigned work",
      name: "Default Project",
    });
  });

  it("archives, filters, protects, and restores a regular Project", async () => {
    const cookie = await registerUser(app, "project-archive@example.com");
    const createResponse = await app.request(`${serverOrigin}/api/v1/projects`, {
      body: JSON.stringify({ name: "Completed Study" }),
      headers: {
        "content-type": "application/json",
        cookie,
        origin: webOrigin,
      },
      method: "POST",
    });
    const { id } = z.object({ id: z.string() }).parse(await createResponse.json());

    const archiveResponse = await app.request(`${serverOrigin}/api/v1/projects/${id}/archive`, {
      headers: { cookie, origin: webOrigin },
      method: "POST",
    });
    const activeListResponse = await app.request(`${serverOrigin}/api/v1/projects`, {
      headers: { cookie, origin: webOrigin },
    });
    const archivedListResponse = await app.request(
      `${serverOrigin}/api/v1/projects?status=archived`,
      { headers: { cookie, origin: webOrigin } },
    );
    const updateResponse = await app.request(`${serverOrigin}/api/v1/projects/${id}`, {
      body: JSON.stringify({ description: "Cannot edit while archived" }),
      headers: {
        "content-type": "application/json",
        cookie,
        origin: webOrigin,
      },
      method: "PATCH",
    });
    const unarchiveResponse = await app.request(`${serverOrigin}/api/v1/projects/${id}/unarchive`, {
      headers: { cookie, origin: webOrigin },
      method: "POST",
    });

    expect(archiveResponse.status).toBe(200);
    expect(await archiveResponse.json()).toMatchObject({ id, status: "archived" });
    expect(await activeListResponse.json()).toMatchObject({
      items: [{ name: "Default Project" }],
    });
    expect(await archivedListResponse.json()).toMatchObject({
      items: [{ id, name: "Completed Study", status: "archived" }],
    });
    expect(updateResponse.status).toBe(409);
    expect(await updateResponse.json()).toMatchObject({ code: "project_archived" });
    expect(unarchiveResponse.status).toBe(200);
    expect(await unarchiveResponse.json()).toMatchObject({ id, status: "active" });
  });

  it("deletes an empty regular Project but protects the Default Project", async () => {
    const cookie = await registerUser(app, "project-delete@example.com");
    const createResponse = await app.request(`${serverOrigin}/api/v1/projects`, {
      body: JSON.stringify({ name: "Disposable" }),
      headers: {
        "content-type": "application/json",
        cookie,
        origin: webOrigin,
      },
      method: "POST",
    });
    const { id } = z.object({ id: z.string() }).parse(await createResponse.json());
    const listResponse = await app.request(`${serverOrigin}/api/v1/projects`, {
      headers: { cookie, origin: webOrigin },
    });
    const defaultProject = z
      .object({ items: z.array(z.object({ id: z.string(), isDefault: z.boolean() })) })
      .parse(await listResponse.json())
      .items.find((project) => project.isDefault);
    expect(defaultProject).toBeDefined();

    const deleteResponse = await app.request(`${serverOrigin}/api/v1/projects/${id}`, {
      headers: { cookie, origin: webOrigin },
      method: "DELETE",
    });
    const deletedGetResponse = await app.request(`${serverOrigin}/api/v1/projects/${id}`, {
      headers: { cookie, origin: webOrigin },
    });
    const defaultDeleteResponse = await app.request(
      `${serverOrigin}/api/v1/projects/${defaultProject?.id}`,
      { headers: { cookie, origin: webOrigin }, method: "DELETE" },
    );

    expect(deleteResponse.status).toBe(204);
    expect(deletedGetResponse.status).toBe(404);
    expect(defaultDeleteResponse.status).toBe(409);
    expect(await defaultDeleteResponse.json()).toMatchObject({
      code: "default_project_immutable",
    });
  });
});
