import { createFileRoute } from "@tanstack/react-router";
import { KeyRoundIcon } from "lucide-react";

import { SettingsPage } from "@/components/settings/settings-page";

export const Route = createFileRoute("/_auth/settings/api-keys")({
  component: ApiKeysSettingsPage,
});

function ApiKeysSettingsPage() {
  return (
    <SettingsPage
      title="API Keys"
      description="Create and manage credentials for programmatic access."
      emptyState="API key management will appear here."
      icon={KeyRoundIcon}
    />
  );
}
