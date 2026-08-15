import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";

import { PageHero } from "@/app/(localized)/[locale]/(public)/_components/page-hero";
import { TechnologyAdvantagesSection } from "@/app/(localized)/[locale]/(public)/_components/technology-advantages-section";
import { TechnologyPipelineSection } from "@/app/(localized)/[locale]/(public)/_components/technology-pipeline-section";
import { publicPageMetadata } from "@/i18n/metadata";
import { resolveAppLocale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/technology">): Promise<Metadata> {
  const locale = resolveAppLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "Technology" });
  return publicPageMetadata({
    locale,
    pathname: "/technology",
    title: t("metadataTitle"),
    description: t("metadataDescription"),
  });
}

export default function TechnologyPage() {
  const t = useTranslations("Technology");

  return (
    <main>
      <PageHero title={t("heroTitle")} subtitle={t("heroSubtitle")} />
      <TechnologyPipelineSection />
      <TechnologyAdvantagesSection />
    </main>
  );
}
