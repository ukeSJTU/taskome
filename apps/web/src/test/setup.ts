import { afterAll, afterEach } from "vitest";

import { server } from "./msw/server";

// Start interception while the setup file is evaluated, before Vitest collects
// test modules. Clients such as Better Auth capture the current fetch function
// when their module-level singleton is created, which happens before beforeAll.
server.listen({ onUnhandledRequest: "error" });
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
