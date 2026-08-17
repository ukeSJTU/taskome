import { oauthProvider } from "@better-auth/oauth-provider";

export const taskomeCliClientId = "taskome-cli";
export const taskomeCLIRedirectURI = "http://127.0.0.1/callback";

export function taskomeOAuthProvider(mcpResource: string, restResource: string) {
  return oauthProvider({
    scopes: ["openid", "profile", "email", "offline_access", "taskome"],
    validAudiences: [mcpResource, restResource],
    disableJwtPlugin: false,
    loginPage: "/login",
    consentPage: "/oauth/consent",
    allowDynamicClientRegistration: true,
    allowUnauthenticatedClientRegistration: true,
    clientRegistrationDefaultScopes: ["taskome"],
    clientRegistrationAllowedScopes: ["taskome"],
    grantTypes: ["authorization_code", "refresh_token"],
    rateLimit: { register: { max: 5, window: 60 } },
  });
}
