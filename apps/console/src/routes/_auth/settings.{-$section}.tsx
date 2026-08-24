import { createFileRoute, notFound } from "@tanstack/react-router";
import { KeyRoundIcon, Settings2Icon, ShieldCheckIcon, UserRoundIcon } from "lucide-react";

const settingsPageContent = {
  general: {
    title: "General",
    description: "Manage workspace defaults and account preferences.",
    emptyState: "General settings controls will appear here.",
    icon: Settings2Icon,
  },
  profile: {
    title: "Profile",
    description: "Manage your personal information and identity in Taskome.",
    emptyState: "Profile settings controls will appear here.",
    icon: UserRoundIcon,
  },
  security: {
    title: "Security",
    description: "Review sign-in methods and account security options.",
    emptyState: "Security settings controls will appear here.",
    icon: ShieldCheckIcon,
  },
  "api-keys": {
    title: "API Keys",
    description: "Create and manage credentials for programmatic access.",
    emptyState: "API key management will appear here.",
    icon: KeyRoundIcon,
  },
};

function getSettingsPage(section: string | undefined) {
  switch (section) {
    case undefined:
      return settingsPageContent.general;
    case "profile":
      return settingsPageContent.profile;
    case "security":
      return settingsPageContent.security;
    case "api-keys":
      return settingsPageContent["api-keys"];
    default:
      return undefined;
  }
}

export const Route = createFileRoute("/_auth/settings/{-$section}")({
  loader: ({ params }) => {
    const page = getSettingsPage(params.section);

    if (!page) {
      throw notFound();
    }

    return page;
  },
  component: SettingsPage,
});

function SettingsPage() {
  const page = Route.useLoaderData();
  const Icon = page.icon;

  return (
    <div className="flex flex-1 flex-col px-4 py-8 md:px-8 lg:px-12">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <header className="flex items-start gap-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-muted/40">
            <Icon className="size-5 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{page.title}</h1>
            <p className="text-sm text-muted-foreground">{page.description}</p>
          </div>
        </header>
        <section className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed bg-muted/20 px-6 text-center">
          <p className="text-sm text-muted-foreground">{page.emptyState}</p>
        </section>
      </div>
    </div>
  );
}
