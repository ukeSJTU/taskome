import { apiKeyClient } from "@better-auth/api-key/client";
import { oauthProviderClient } from "@better-auth/oauth-provider/client";
import { createAuthClient } from "better-auth/react";
import { jwtClient, twoFactorClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  fetchOptions: {
    onRequest(context) {
      if (typeof document === "undefined") return;

      const locale = document.documentElement.lang === "zh-CN" ? "zh-CN" : "en";
      context.headers.set("x-taskome-locale", locale);
    },
  },
  plugins: [
    apiKeyClient(),
    jwtClient(),
    oauthProviderClient(),
    twoFactorClient({ twoFactorPage: "/two-factor" }),
  ],
});
