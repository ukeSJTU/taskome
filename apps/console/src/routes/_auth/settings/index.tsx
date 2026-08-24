import { createFileRoute } from "@tanstack/react-router";

import { GeneralSettingsPage } from "@/components/settings/general-settings-page";

export const Route = createFileRoute("/_auth/settings/")({
  component: GeneralSettingsPage,
});
