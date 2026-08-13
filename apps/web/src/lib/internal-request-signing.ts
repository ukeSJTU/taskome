import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

const SIGNATURE_MAX_AGE_SECONDS = 300;

export function verifyInternalRequestSignature({
  body,
  headers,
  secret,
  now = Date.now(),
}: {
  body: string;
  headers: Headers;
  secret: string;
  now?: number;
}) {
  const timestampValue = headers.get("x-taskome-timestamp");
  const signature = headers.get("x-taskome-signature");
  if (
    !timestampValue ||
    !signature ||
    !/^\d+$/.test(timestampValue) ||
    !/^[0-9a-f]{64}$/.test(signature)
  ) {
    return false;
  }

  const timestamp = Number(timestampValue);
  const age = Math.abs(Math.floor(now / 1000) - timestamp);
  if (!Number.isSafeInteger(timestamp) || age > SIGNATURE_MAX_AGE_SECONDS) return false;

  const expected = createHmac("sha256", secret).update(`${timestampValue}.`).update(body).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
