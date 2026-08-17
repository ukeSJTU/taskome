import "server-only";

import { auth } from "@taskome/auth";
import { env } from "@taskome/env/server";
import { headers } from "next/headers";

import type { ProblemDetails } from "./generated/gateway/models";

export type GatewayProblemDetails = ProblemDetails;

export class GatewayAuthenticationError extends Error {
  constructor() {
    super("A signed-in session is required for gateway access.");
    this.name = "GatewayAuthenticationError";
  }
}

export class GatewayHttpError extends Error {
  readonly headers: Headers;
  readonly problem: GatewayProblemDetails;
  readonly status: number;

  constructor(response: Response, problem: GatewayProblemDetails) {
    super(`Gateway request failed with status ${response.status}: ${problem.title}.`);
    this.name = "GatewayHttpError";
    this.headers = response.headers;
    this.problem = problem;
    this.status = response.status;
  }
}

export class GatewayProtocolError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "GatewayProtocolError";
  }
}

export class GatewayTransportError extends Error {
  constructor(cause: unknown) {
    super("Gateway request could not be completed.", { cause });
    this.name = "GatewayTransportError";
  }
}

function isJsonResponse(response: Response): boolean {
  return (
    response.headers.get("content-type")?.toLowerCase().startsWith("application/json") ?? false
  );
}

function isProblemDetails(value: unknown): value is GatewayProblemDetails {
  if (value === null || typeof value !== "object") return false;

  const problem = value as Record<string, unknown>;
  return (
    typeof problem.type === "string" &&
    typeof problem.title === "string" &&
    typeof problem.status === "number" &&
    typeof problem.detail === "string" &&
    typeof problem.instance === "string" &&
    typeof problem.request_id === "string"
  );
}

async function gatewayHttpError(response: Response): Promise<GatewayHttpError> {
  const contentType = response.headers.get("content-type")?.toLowerCase();
  if (!contentType?.startsWith("application/problem+json")) {
    throw new GatewayProtocolError("Gateway returned a non-Problem Details error response.");
  }

  let problem: unknown;
  try {
    problem = await response.json();
  } catch (cause) {
    throw new GatewayProtocolError("Gateway returned invalid Problem Details JSON.", { cause });
  }
  if (!isProblemDetails(problem)) {
    throw new GatewayProtocolError("Gateway returned invalid Problem Details.");
  }

  return new GatewayHttpError(response, problem);
}

export async function gatewayFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const sessionToken = await auth.api.getToken({ headers: await headers() });
  if (!sessionToken?.token) throw new GatewayAuthenticationError();

  const requestHeaders = new Headers(init.headers);
  requestHeaders.set("authorization", `Bearer ${sessionToken.token}`);

  let response: Response;
  try {
    response = await fetch(new URL(`/v1${url}`, env.GATEWAY_INTERNAL_URL), {
      ...init,
      cache: "no-store",
      headers: requestHeaders,
    });
  } catch (cause) {
    throw new GatewayTransportError(cause);
  }
  if (!response.ok) throw await gatewayHttpError(response);
  if ([204, 205, 304].includes(response.status)) return undefined as T;
  if (!isJsonResponse(response)) {
    throw new GatewayProtocolError("Gateway returned a non-JSON success response.");
  }

  try {
    return (await response.json()) as T;
  } catch (cause) {
    throw new GatewayProtocolError("Gateway returned invalid JSON.", { cause });
  }
}
