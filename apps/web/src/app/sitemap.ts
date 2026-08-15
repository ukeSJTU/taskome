import type { MetadataRoute } from "next";

import { env } from "@taskome/env/server";

import { localizedPath } from "@/i18n/metadata";
import { publicPathnames } from "@/i18n/routing";

function absoluteUrl(pathname: string) {
  return new URL(pathname, env.WEB_PUBLIC_URL).toString();
}

export default function sitemap(): MetadataRoute.Sitemap {
  return publicPathnames.flatMap((pathname) => {
    const languages = {
      "zh-CN": absoluteUrl(pathname),
      en: absoluteUrl(localizedPath("en", pathname)),
    };

    return [
      {
        url: languages["zh-CN"],
        alternates: { languages },
      },
      {
        url: languages.en,
        alternates: { languages },
      },
    ];
  });
}
