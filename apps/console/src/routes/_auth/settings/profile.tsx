import { createFileRoute } from "@tanstack/react-router";
import { UserRoundIcon } from "lucide-react";

import { SettingsPage } from "@/components/settings/settings-page";

export const Route = createFileRoute("/_auth/settings/profile")({
  component: ProfileSettingsPage,
});

function ProfileSettingsPage() {
  return (
    <SettingsPage
      title="Profile"
      description="Manage your personal information and identity in Taskome."
      emptyState="Profile settings controls will appear here."
      icon={UserRoundIcon}
    />
  );
}
