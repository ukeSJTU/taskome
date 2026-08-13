import "server-only";

import { auth } from "@taskome/auth";
import { env } from "@taskome/env/server";
import { headers } from "next/headers";

export class GatewayAuthenticationError extends Error {
  constructor() {
    super("A signed-in session is required for gateway access.");
    this.name = "GatewayAuthenticationError";
  }
}

export async function gatewayFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const sessionToken = await auth.api.getToken({ headers: await headers() });
  if (!sessionToken?.token) throw new GatewayAuthenticationError();

  const requestHeaders = new Headers(init.headers);
  requestHeaders.set("authorization", `Bearer ${sessionToken.token}`);

  return fetch(new URL(path, env.GATEWAY_URL), {
    ...init,
    cache: "no-store",
    headers: requestHeaders,
  });
}
