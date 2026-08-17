import type { ApiKey } from "@better-auth/api-key/client";

export type ManagedApiKey = Omit<ApiKey, "key">;

export const dateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatDate(value: Date | string) {
  return dateFormatter.format(new Date(value));
}
