import { GalleryVerticalEndIcon } from "lucide-react";

import { SignupForm } from "@/app/(localized)/[locale]/(auth)/_components/signup-form";
import { LanguageSwitcher } from "@/app/(localized)/[locale]/_components/language-switcher";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";

export default async function SignupPage() {
  const t = await getTranslations("Auth");

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
            <SignupForm />
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
