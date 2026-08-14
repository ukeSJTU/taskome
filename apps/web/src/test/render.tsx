import { render as rtlRender, type RenderOptions } from "@testing-library/react";
import type { ReactElement } from "react";

import { ThemeProvider } from "@/app/(app)/_components/theme-provider";

function AllProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}

export function render(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  return rtlRender(ui, { wrapper: AllProviders, ...options });
}

export * from "@testing-library/react";
