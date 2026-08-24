import { env } from "@taskome/env/console";

import { getServerUrl } from "@/lib/server-url";

export async function apiFetch<T>(url: string, options: RequestInit): Promise<T> {
  const response = await fetch(new URL(url, getServerUrl(env.VITE_SERVER_URL)), {
    ...options,
    credentials: "include",
  });

  if (!response.ok) {
    if (response.headers.get("content-type")?.includes("application/problem+json")) {
      let problem: unknown;
      try {
        problem = await response.json();
      } catch {
        throw new Error(`API request failed with status ${response.status}.`);
      }
      throw problem;
    }

    throw new Error(`API request failed with status ${response.status}.`);
  }

  if (response.status === 204) {
    return response.json().catch(() => undefined);
  }

  return response.json();
}
