import { createFileRoute } from "@tanstack/react-router";

import { ProfileSettingsPage } from "@/components/settings/profile-settings-page";

export const Route = createFileRoute("/_auth/settings/profile")({
  component: ProfileSettingsPage,
});
