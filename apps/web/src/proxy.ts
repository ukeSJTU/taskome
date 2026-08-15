import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  matcher: [
    "/",
    "/about",
    "/products",
    "/technology",
    "/platform-cases",
    "/contact",
    "/legal",
    "/privacy",
    "/login",
    "/signup",
    "/oauth/consent",
    "/two-factor",
    "/security/two-factor",
    "/en/:path*",
    "/zh-CN/:path*",
  ],
};
