import type { Metadata } from "next";

import { privatePageMetadata } from "@/i18n/metadata";

export const metadata: Metadata = privatePageMetadata;

export default function OAuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
