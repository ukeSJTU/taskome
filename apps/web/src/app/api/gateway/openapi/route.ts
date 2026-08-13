import { auth } from "@taskome/auth";
import { env } from "@taskome/env/server";
import { headers } from "next/headers";
import { z } from "zod";

const openApiProjection = z
  .object({
    info: z.object({ title: z.string(), version: z.string() }).passthrough(),
    openapi: z.string(),
    paths: z.record(z.string(), z.unknown()),
    servers: z.array(z.object({ url: z.url() }).passthrough()).min(1),
  })
  .passthrough();

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ error: "authentication_required" }, { status: 401 });
  }

  try {
    const response = await fetch(new URL("/internal/openapi.json", env.GATEWAY_INTERNAL_URL), {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error("Gateway OpenAPI request failed");
    const projection = openApiProjection.parse(await response.json());
    return Response.json(projection, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "api_reference_unavailable" }, { status: 502 });
  }
}
