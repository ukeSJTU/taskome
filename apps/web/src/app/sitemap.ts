import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site-config";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteConfig.origins.web.toString(),
      lastModified: new Date("2026-08-25T00:00:00.000Z"),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
