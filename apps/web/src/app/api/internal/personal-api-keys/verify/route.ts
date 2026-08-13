import { auth } from "@taskome/auth";
import { env } from "@taskome/env/server";

import { verifyInternalRequestSignature } from "@/lib/internal-request-signing";

const inactive = { active: false, key_id: null, user_id: null } as const;

export async function POST(request: Request) {
  const body = await request.text();
  if (
    !verifyInternalRequestSignature({
      body,
      headers: request.headers,
      secret: env.WEB_GATEWAY_HMAC_SECRET,
    })
  ) {
    return Response.json({ error: "invalid_internal_signature" }, { status: 401 });
  }

  let key: unknown;
  try {
    const parsed = JSON.parse(body) as unknown;
    key = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>).key : null;
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  if (typeof key !== "string" || !key) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const verification = await auth.api.verifyApiKey({ body: { key } });
  if (!verification.valid || !verification.key?.referenceId) return Response.json(inactive);

  const context = await auth.$context;
  const user = await context.internalAdapter.findUserById(verification.key.referenceId);
  if (!user) return Response.json(inactive);

  return Response.json({
    active: true,
    key_id: verification.key.id,
    user_id: user.id,
  });
}
