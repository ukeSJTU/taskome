import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import localeProxy, { config as localeProxyConfig } from "./proxy";

const localizedPaths = [
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
  "/en",
  "/en/about",
  "/zh-CN/about",
];

const applicationAndInfrastructurePaths = [
  "/dashboard",
  "/account/api-keys",
  "/api/auth/sign-in/email",
  "/.well-known/oauth-authorization-server",
  "/_next/static/app.js",
  "/favicon.ico",
];

function matches(url: string) {
  return localeProxyConfig.matcher.some((matcher) => {
    if (matcher.endsWith("/:path*")) {
      const prefix = matcher.slice(0, -"/:path*".length);
      return url === prefix || url.startsWith(`${prefix}/`);
    }

    return url === matcher;
  });
}

describe("locale proxy", () => {
  it.each(localizedPaths)("matches localized route %s", (url) => {
    expect(matches(url)).toBe(true);
  });

  it.each(applicationAndInfrastructurePaths)("does not match %s", (url) => {
    expect(matches(url)).toBe(false);
  });

  it("redirects an English browser from the unprefixed default URL", () => {
    const response = localeProxy(
      new NextRequest("http://localhost:3000/", {
        headers: { "accept-language": "en-US,en;q=0.9" },
      }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/en");
  });

  it("prefers a remembered locale over the browser language", () => {
    const response = localeProxy(
      new NextRequest("http://localhost:3000/", {
        headers: {
          "accept-language": "zh-CN,zh;q=0.9",
          cookie: "NEXT_LOCALE=en",
        },
      }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/en");
  });
});
