import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";

import { AboutMissionSection } from "@/app/(localized)/[locale]/(public)/_components/about-mission-section";
import { AboutTeamSection } from "@/app/(localized)/[locale]/(public)/_components/about-team-section";
import { AboutTimelineSection } from "@/app/(localized)/[locale]/(public)/_components/about-timeline-section";
import { PageHero } from "@/app/(localized)/[locale]/(public)/_components/page-hero";
import { publicPageMetadata } from "@/i18n/metadata";
import { resolveAppLocale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/about">): Promise<Metadata> {
  const locale = resolveAppLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "About" });
  return publicPageMetadata({
    locale,
    pathname: "/about",
    title: t("metadataTitle"),
    description: t("metadataDescription"),
  });
}

export default function AboutPage() {
  const t = useTranslations("About");

  return (
    <main>
      <PageHero title={t("heroTitle")} subtitle={t("heroSubtitle")} />
      <AboutMissionSection />
      <AboutTeamSection />
      <AboutTimelineSection />
    </main>
  );
}
