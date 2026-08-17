import { auth } from "@taskome/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function GeneralSettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <section className="max-w-2xl px-4 py-6 lg:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">General</h1>
      <p className="mt-2 text-sm text-muted-foreground">Your Taskome account details.</p>
      <dl className="mt-6 divide-y border-y text-sm">
        <div className="grid gap-1 py-4 sm:grid-cols-3 sm:gap-4">
          <dt className="text-muted-foreground">Name</dt>
          <dd className="sm:col-span-2">{session.user.name}</dd>
        </div>
        <div className="grid gap-1 py-4 sm:grid-cols-3 sm:gap-4">
          <dt className="text-muted-foreground">Email</dt>
          <dd className="sm:col-span-2">{session.user.email}</dd>
        </div>
      </dl>
    </section>
  );
}
