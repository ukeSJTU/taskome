import type { MetadataRoute } from "next";

import { env } from "@taskome/env/server";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/account/",
        "/dashboard",
        "/login",
        "/signup",
        "/oauth/",
        "/two-factor",
        "/security/",
        "/en/login",
        "/en/signup",
        "/en/oauth/",
        "/en/two-factor",
        "/en/security/",
      ],
    },
    sitemap: new URL("/sitemap.xml", env.WEB_PUBLIC_URL).toString(),
  };
}
