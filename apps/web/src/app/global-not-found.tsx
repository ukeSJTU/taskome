import type { Metadata } from "next";
import { Geist } from "next/font/google";

import "../index.css";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "404 — Page not found | 页面未找到",
  robots: { index: false, follow: false },
};

export default function GlobalNotFound() {
  return (
    <html lang="zh-CN">
      <body className={`${geist.className} bg-background text-foreground`}>
        <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-center gap-4 p-6">
          <p className="text-sm text-muted-foreground">404</p>
          <h1 className="text-3xl font-semibold">页面未找到</h1>
          <p className="text-muted-foreground">The page you requested could not be found.</p>
          <a className="font-medium underline underline-offset-4" href="/">
            返回首页 / Return home
          </a>
        </main>
      </body>
    </html>
  );
}
