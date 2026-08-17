import { auth } from "@taskome/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AppSidebar } from "@/app/(application)/(app)/_components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@taskome/ui/components/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <SidebarProvider className="xdenovo-app">
      <AppSidebar
        variant="inset"
        user={{
          name: session.user.name,
          email: session.user.email,
          avatar: session.user.image ?? "",
        }}
      />
      <SidebarInset>
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
