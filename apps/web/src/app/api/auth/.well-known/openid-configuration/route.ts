import { oauthProviderOpenIdConfigMetadata } from "@better-auth/oauth-provider";
import { auth } from "@taskome/auth";

const metadata = oauthProviderOpenIdConfigMetadata(auth);

export const GET = (request: Request) => metadata(request);
