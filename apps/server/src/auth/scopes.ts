export const taskomeScopes = ["taskome:access"] as const;

export type TaskomeScope = (typeof taskomeScopes)[number];

const taskomeScopeSet = new Set<string>(taskomeScopes);

export function parseTaskomeScopes(scopes: readonly string[]): TaskomeScope[] {
  if (scopes.some((scope) => !taskomeScopeSet.has(scope))) {
    throw new Error("Unsupported Taskome scope");
  }
  return [...new Set(scopes)] as TaskomeScope[];
}

export function scopePermissions(scopes: readonly TaskomeScope[]) {
  return {
    taskome: scopes.map((scope) => scope.slice("taskome:".length)),
  };
}

export function permissionsToScopes(
  permissions: Record<string, string[]> | null | undefined,
): TaskomeScope[] {
  return parseTaskomeScopes((permissions?.taskome ?? []).map((action) => `taskome:${action}`));
}
