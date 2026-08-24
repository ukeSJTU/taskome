import { getOAuthProviderState } from "@better-auth/oauth-provider";

import { parseTaskomeScopes, type TaskomeScope } from "./scopes";

export interface OAuthAuthorizationInput {
  clientId: string;
  resource: string;
  scopes: TaskomeScope[];
}

export type GetOAuthProviderState = typeof getOAuthProviderState;

export function createOAuthAuthorizationInputResolver(
  getState: GetOAuthProviderState = getOAuthProviderState,
) {
  return async (expectedResource: string, grantedScopes: readonly string[]) => {
    const state = await getState();
    if (!state?.query) throw new Error("OAuth provider state is unavailable");

    const query = new URLSearchParams(state.query);
    const clientId = query.get("client_id");
    const resources = query.getAll("resource");
    if (!clientId || resources.length !== 1 || resources[0] !== expectedResource) {
      throw new Error("OAuth authorization input does not match the MCP resource");
    }

    return {
      clientId,
      resource: expectedResource,
      scopes: parseTaskomeScopes(grantedScopes.filter((scope) => scope.startsWith("taskome:"))),
    } satisfies OAuthAuthorizationInput;
  };
}
