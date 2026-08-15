import type { Metadata } from "next";

import { env } from "@taskome/env/server";

import type { AppLocale, PublicPathname } from "./routing";

export function localizedPath(locale: AppLocale, pathname: PublicPathname) {
  if (locale === "en") return pathname === "/" ? "/en" : `/en${pathname}`;
  return pathname;
}

export function publicPageMetadata({
  locale,
  pathname,
  title,
  description,
}: {
  locale: AppLocale;
  pathname: PublicPathname;
  title: string;
  description: string;
}): Metadata {
  return {
    metadataBase: new URL(env.WEB_PUBLIC_URL),
    title,
    description,
    alternates: {
      canonical: localizedPath(locale, pathname),
      languages: {
        "zh-CN": pathname,
        en: localizedPath("en", pathname),
        "x-default": pathname,
      },
    },
  };
}

export const privatePageMetadata: Metadata = {
  robots: { index: false, follow: false },
};
