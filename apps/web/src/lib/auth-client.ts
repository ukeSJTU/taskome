import { apiKeyClient } from "@better-auth/api-key/client";
import { oauthProviderClient } from "@better-auth/oauth-provider/client";
import { createAuthClient } from "better-auth/react";
import { jwtClient, twoFactorClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [
    apiKeyClient(),
    jwtClient(),
    oauthProviderClient(),
    twoFactorClient({ twoFactorPage: "/two-factor" }),
  ],
});
