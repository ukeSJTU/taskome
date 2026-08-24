import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/settings")({
  component: SettingsLayout,
});

function SettingsLayout() {
  return (
    <div className="flex flex-1 flex-col px-4 py-8 md:px-8 lg:px-12">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <Outlet />
      </div>
    </div>
  );
}
