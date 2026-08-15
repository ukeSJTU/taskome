import { defineRouting } from "next-intl/routing";
import { hasLocale } from "next-intl";

export const publicPathnames = [
  "/",
  "/about",
  "/products",
  "/technology",
  "/platform-cases",
  "/contact",
  "/legal",
  "/privacy",
] as const;

export type PublicPathname = (typeof publicPathnames)[number];

export const routing = defineRouting({
  locales: ["zh-CN", "en"],
  defaultLocale: "zh-CN",
  localePrefix: "as-needed",
  localeDetection: true,
  localeCookie: {
    name: "NEXT_LOCALE",
    sameSite: "lax",
  },
  alternateLinks: false,
  pathnames: {
    "/": "/",
    "/about": "/about",
    "/products": "/products",
    "/technology": "/technology",
    "/platform-cases": "/platform-cases",
    "/contact": "/contact",
    "/legal": "/legal",
    "/privacy": "/privacy",
    "/login": "/login",
    "/signup": "/signup",
    "/oauth/consent": "/oauth/consent",
    "/two-factor": "/two-factor",
    "/security/two-factor": "/security/two-factor",
  },
});

export type AppLocale = (typeof routing.locales)[number];

export function resolveAppLocale(locale: string): AppLocale {
  return hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
}
