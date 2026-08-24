import type { LucideIcon } from "lucide-react";

export function SettingsPage({
  title,
  description,
  emptyState,
  icon: Icon,
}: {
  title: string;
  description: string;
  emptyState: string;
  icon: LucideIcon;
}) {
  return (
    <>
      <header className="flex items-start gap-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-muted/40">
          <Icon className="size-5 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </header>
      <section className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed bg-muted/20 px-6 text-center">
        <p className="text-sm text-muted-foreground">{emptyState}</p>
      </section>
    </>
  );
}
