import "@taskome/ui/globals.css";

import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import { cn } from "@taskome/ui/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html className={cn("font-sans", inter.variable)}>
      <body>{children}</body>
    </html>
  );
}
