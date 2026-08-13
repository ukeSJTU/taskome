import { createTestAuth } from "@taskome/auth/test";
import { http } from "msw";

import { server } from "./msw/server";

/**
 * Give a component test a fresh, isolated better-auth backend for the duration of
 * one test: `authClient`'s fetch calls are routed through MSW to a brand-new
 * `createTestAuth()` instance instead of a hand-mocked stub, so login/signup/2FA
 * flows exercise real validation and state transitions. A fresh instance per call
 * is required — the in-memory adapter would otherwise leak state across tests.
 */
export async function useTestAuth() {
  const auth = createTestAuth();
  server.use(http.all("http://localhost:3000/api/auth/*", ({ request }) => auth.handler(request)));
  const { test } = await auth.$context;
  return test;
}
