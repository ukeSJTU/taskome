"use client";

import { Toaster } from "@taskome/ui/components/sonner";

import { ThemeProvider } from "@/app/(app)/_components/theme-provider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
      <Toaster richColors />
    </ThemeProvider>
  );
}
