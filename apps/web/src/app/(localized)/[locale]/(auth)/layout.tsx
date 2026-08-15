import type { Metadata } from "next";
import { auth } from "@taskome/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { privatePageMetadata } from "@/i18n/metadata";

export const metadata: Metadata = privatePageMetadata;

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session?.user) {
    // TODO: honor a callbackUrl query param instead of always redirecting to /dashboard
    redirect("/dashboard");
  }

  return children;
}
