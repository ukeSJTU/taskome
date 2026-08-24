import { Settings2Icon } from "lucide-react";

import { SettingsPage } from "@/components/settings/settings-page";

export function GeneralSettingsPage() {
  return (
    <SettingsPage
      title="General"
      description="Manage workspace defaults and account preferences."
      emptyState="General settings controls will appear here."
      icon={Settings2Icon}
    />
  );
}
