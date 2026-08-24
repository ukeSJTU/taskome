import { createFileRoute } from "@tanstack/react-router";

import { ApiKeysSettingsPage } from "@/components/settings/api-keys-settings-page";

export const Route = createFileRoute("/_auth/settings/api-keys")({
  component: ApiKeysSettingsPage,
});
