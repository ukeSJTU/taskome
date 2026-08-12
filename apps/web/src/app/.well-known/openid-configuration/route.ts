import { auth } from "@taskome/auth";
import { oauthProviderOpenIdConfigMetadata } from "@better-auth/oauth-provider";

const metadata = oauthProviderOpenIdConfigMetadata(auth);

export const GET = (request: Request) => metadata(request);
