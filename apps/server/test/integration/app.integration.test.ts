import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp, type App } from "@/app";
import { createSessionResolver } from "@/auth/session";
import type { DatabaseRuntime } from "@/db/database";

const serverOrigin = "http://localhost:3000";
const webOrigin = "http://localhost:3001";

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
    });
  });

  afterAll(async () => {
    await database?.close();
    await container?.stop();
  });

  it("migrates from empty, creates a session, and exposes the current user", async () => {
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

    const meResponse = await app.request(`${serverOrigin}/api/v1/me`, {
      headers: {
        cookie: cookie ?? "",
        origin: webOrigin,
      },
    });

    expect(meResponse.status).toBe(200);
    expect(await meResponse.json()).toEqual({
      email,
      emailVerified: false,
      id: expect.any(String),
      image: null,
      name: "Integration User",
    });
  });

  it("reports readiness through the migrated database", async () => {
    const response = await app.request("/readyz");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ready" });
  });
});
