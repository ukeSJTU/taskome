import type { HttpHandler } from "msw";

/**
 * No gateway endpoint needs a network-level fake yet: nothing client-side calls
 * @taskome/api-client (its gatewayFetch is server-only), and the node-project route
 * handler tests that do call it still mock the module boundary directly (see
 * docs/agents/testing.md). Add a handler here the first time a test needs real
 * network/error-handling semantics for a specific gateway endpoint.
 */
export const handlers: HttpHandler[] = [];
