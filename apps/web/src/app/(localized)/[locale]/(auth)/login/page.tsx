import { GalleryVerticalEndIcon } from "lucide-react";

import { LoginForm } from "@/app/(localized)/[locale]/(auth)/_components/login-form";
import { LanguageSwitcher } from "@/app/(localized)/[locale]/_components/language-switcher";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";

function createOAuthContinuation(searchParams: Record<string, string | string[] | undefined>) {
  if (typeof searchParams.client_id !== "string") {
    return "/dashboard" as const;
  }

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      if (item !== undefined) {
        query.append(key, item);
      }
    }
  }

  return `/api/auth/oauth2/authorize?${query.toString()}` as const;
}

export default async function LoginPage({ searchParams }: PageProps<"/[locale]/login">) {
  const t = await getTranslations("Auth");
  const afterSignIn = createOAuthContinuation(await searchParams);

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <Link href="/" className="flex items-center gap-2 font-medium">
            <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <GalleryVerticalEndIcon className="size-4" />
            </div>
            Taskome
          </Link>
          <LanguageSwitcher className="ml-auto text-sm font-medium underline underline-offset-4" />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <LoginForm afterSignIn={afterSignIn} />
            <p className="mt-6 text-center text-xs text-muted-foreground">
              {t("workspaceEnglishNotice")}
            </p>
          </div>
        </div>
      </div>
      <div className="hidden bg-gradient-to-br from-muted via-background to-muted lg:block" />
    </div>
  );
}
