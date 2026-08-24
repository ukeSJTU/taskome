import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheckIcon } from "lucide-react";

import { SettingsPage } from "@/components/settings/settings-page";

export const Route = createFileRoute("/_auth/settings/security")({
  component: SecuritySettingsPage,
});

function SecuritySettingsPage() {
  return (
    <SettingsPage
      title="Security"
      description="Review sign-in methods and account security options."
      emptyState="Security settings controls will appear here."
      icon={ShieldCheckIcon}
    />
  );
}
