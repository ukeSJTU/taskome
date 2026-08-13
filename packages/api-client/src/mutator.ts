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

export class GatewayResponseError extends Error {
  readonly response: Response;

  constructor(response: Response) {
    super(`Gateway request failed with status ${response.status}.`);
    this.name = "GatewayResponseError";
    this.response = response;
  }
}

export async function gatewayFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const sessionToken = await auth.api.getToken({ headers: await headers() });
  if (!sessionToken?.token) throw new GatewayAuthenticationError();

  const requestHeaders = new Headers(init.headers);
  requestHeaders.set("authorization", `Bearer ${sessionToken.token}`);

  const response = await fetch(new URL(url, env.GATEWAY_URL), {
    ...init,
    cache: "no-store",
    headers: requestHeaders,
  });
  if (!response.ok) throw new GatewayResponseError(response);

  return {
    data: await response.json(),
    headers: response.headers,
    status: response.status,
  } as T;
}
