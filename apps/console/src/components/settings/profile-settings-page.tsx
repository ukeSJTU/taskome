import { UserRoundIcon } from "lucide-react";

import { SettingsPage } from "@/components/settings/settings-page";

export function ProfileSettingsPage() {
  return (
    <SettingsPage
      title="Profile"
      description="Manage your personal information and identity in Taskome."
      emptyState="Profile settings controls will appear here."
      icon={UserRoundIcon}
    />
  );
}
