import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";

import { PageHero } from "@/app/(localized)/[locale]/(public)/_components/page-hero";
import { PlatformCasesSection } from "@/app/(localized)/[locale]/(public)/_components/platform-cases-section";
import { PlatformCasesStatsSection } from "@/app/(localized)/[locale]/(public)/_components/platform-cases-stats-section";
import { publicPageMetadata } from "@/i18n/metadata";
import { resolveAppLocale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/platform-cases">): Promise<Metadata> {
  const locale = resolveAppLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "PlatformCases" });
  return publicPageMetadata({
    locale,
    pathname: "/platform-cases",
    title: t("metadataTitle"),
    description: t("metadataDescription"),
  });
}

export default function PlatformCasesPage() {
  const t = useTranslations("PlatformCases");

  return (
    <main>
      <PageHero title={t("heroTitle")} subtitle={t("heroSubtitle")} />
      <PlatformCasesSection />
      <PlatformCasesStatsSection />
    </main>
  );
}
