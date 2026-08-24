import { createFileRoute } from "@tanstack/react-router";

import { SecuritySettingsPage } from "@/components/settings/security-settings-page";

export const Route = createFileRoute("/_auth/settings/security")({
  component: SecuritySettingsPage,
});
