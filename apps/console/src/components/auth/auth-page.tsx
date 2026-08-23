import { Link } from "@tanstack/react-router";
import { Skeleton } from "@taskome/ui/components/skeleton";
import { CommandIcon } from "lucide-react";
import type { ReactNode } from "react";

export function AuthPage({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center md:justify-start">
          <Link to="/" className="flex items-center gap-2 font-medium">
            <CommandIcon aria-hidden="true" />
            Taskome
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">{children}</div>
        </div>
      </div>
      <div className="hidden bg-muted p-6 lg:block" aria-hidden="true">
        <Skeleton className="size-full rounded-xl" />
      </div>
    </main>
  );
}
