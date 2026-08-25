import "@taskome/ui/globals.css";
import "@taskome/ui/tokens/web.css";
import "./marketing.css";

import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Newsreader } from "next/font/google";
import type { ReactNode } from "react";
import { cn } from "@taskome/ui/lib/utils";

import { siteConfig } from "@/lib/site-config";

const bodyFont = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-ibm-plex-sans",
  weight: "variable",
});

const displayFont = Newsreader({
  axes: ["opsz"],
  subsets: ["latin"],
  variable: "--font-newsreader",
  weight: "variable",
});

const dataFont = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-ibm-plex-mono",
  weight: ["400", "500"],
});

const title = "XDenovo | Reproducible protein-design compute";
const description =
  "XDenovo builds Taskome, a platform for running, managing, and reproducing protein-design compute through curated Tools and durable provenance.";

export const metadata: Metadata = {
  metadataBase: siteConfig.origins.web,
  title,
  description,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title,
    description,
    locale: "en_US",
    siteName: "XDenovo",
    type: "website",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  robots: {
    follow: true,
    index: true,
    googleBot: {
      follow: true,
      index: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f7f9f1",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="en"
      data-surface="web"
      data-theme="light"
      className={cn(bodyFont.variable, displayFont.variable, dataFont.variable)}
    >
      <body>{children}</body>
    </html>
  );
}
