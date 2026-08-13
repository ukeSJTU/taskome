import { oauthProvider } from "@better-auth/oauth-provider";

export function mcpOAuthProvider(mcpResource: string) {
  return oauthProvider({
    scopes: ["openid", "profile", "email", "taskome"],
    validAudiences: [mcpResource],
    disableJwtPlugin: false,
    loginPage: "/login",
    consentPage: "/oauth/consent",
    allowDynamicClientRegistration: true,
    allowUnauthenticatedClientRegistration: true,
    clientRegistrationDefaultScopes: ["taskome"],
    clientRegistrationAllowedScopes: ["taskome"],
    grantTypes: ["authorization_code"],
    rateLimit: { register: { max: 5, window: 60 } },
  });
}
