import { createFileRoute } from "@tanstack/react-router";
import { Settings2Icon } from "lucide-react";

import { SettingsPage } from "@/components/settings/settings-page";

export const Route = createFileRoute("/_auth/settings/")({
  component: GeneralSettingsPage,
});

function GeneralSettingsPage() {
  return (
    <SettingsPage
      title="General"
      description="Manage workspace defaults and account preferences."
      emptyState="General settings controls will appear here."
      icon={Settings2Icon}
    />
  );
}
