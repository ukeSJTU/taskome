"use client";

import { useLocale, useTranslations } from "next-intl";
import type { MouseEventHandler } from "react";

import { Link, usePathname, useRouter } from "@/i18n/navigation";

export function LanguageSwitcher({
  className,
  onClick,
  tabIndex,
}: {
  className?: string;
  onClick?: () => void;
  tabIndex?: number;
}) {
  const locale = useLocale();
  const t = useTranslations("Common");
  const pathname = usePathname();
  const router = useRouter();
  const targetLocale = locale === "en" ? "zh-CN" : "en";
  const switchLocale: MouseEventHandler<HTMLAnchorElement> = (event) => {
    event.preventDefault();
    const searchParams = new URLSearchParams(window.location.search);
    const href =
      searchParams.size > 0 ? { pathname, query: Object.fromEntries(searchParams) } : pathname;
    router.replace(href, { locale: targetLocale });
    onClick?.();
  };

  return (
    <Link
      href={pathname}
      locale={targetLocale}
      className={className}
      onClick={switchLocale}
      tabIndex={tabIndex}
      aria-label={locale === "en" ? t("switchToChinese") : t("switchToEnglish")}
    >
      {locale === "en" ? t("languageChinese") : t("languageEnglish")}
    </Link>
  );
}
