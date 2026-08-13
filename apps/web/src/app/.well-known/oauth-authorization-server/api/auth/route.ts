import { auth } from "@taskome/auth";
import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider";

const metadata = oauthProviderAuthServerMetadata(auth);

export const GET = (request: Request) => metadata(request);
