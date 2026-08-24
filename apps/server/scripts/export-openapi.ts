import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { createApp } from "../src/app";
import { createRestSecurityContextResolver } from "../src/auth/security-context";

const outputPath = fileURLToPath(new URL("../openapi.json", import.meta.url));
const unavailable = () => Promise.reject(new Error("OpenAPI export has no runtime service"));

const app = createApp({
  apiKeyService: {
    create: unavailable,
    get: () => Promise.resolve(null),
    list: () => Promise.resolve([]),
    revoke: () => Promise.resolve(false),
    update: () => Promise.resolve(null),
  },
  authHandler: () => new Response(null, { status: 404 }),
  checkReadiness: async () => {},
  corsOrigin: "http://localhost:3001",
  getSession: async () => null,
  oauthGrantService: {
    get: () => Promise.resolve(undefined),
    list: () => Promise.resolve([]),
    revoke: () => Promise.resolve(false),
  },
  resolveSecurityContext: createRestSecurityContextResolver({
    getSession: async () => null,
    resource: "http://localhost:3000/api/v1",
    verifyApiKey: async () => null,
  }),
});
const response = await app.request("/openapi.json");

if (!response.ok) {
  throw new Error(`OpenAPI export failed with status ${response.status}.`);
}

const document = await response.json();
await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`);
