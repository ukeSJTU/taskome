import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { HeroSection } from "@/app/(localized)/[locale]/(public)/_components/hero-section";
import { MissionSection } from "@/app/(localized)/[locale]/(public)/_components/mission-section";
import { PipelineSection } from "@/app/(localized)/[locale]/(public)/_components/pipeline-section";
import { ProductsSection } from "@/app/(localized)/[locale]/(public)/_components/products-section";
import { TeamSection } from "@/app/(localized)/[locale]/(public)/_components/team-section";
import { ValidationSection } from "@/app/(localized)/[locale]/(public)/_components/validation-section";
import { publicPageMetadata } from "@/i18n/metadata";
import { resolveAppLocale } from "@/i18n/routing";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const locale = resolveAppLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "Home" });
  return publicPageMetadata({
    locale,
    pathname: "/",
    title: t("metadataTitle"),
    description: t("metadataDescription"),
  });
}

export default function Home() {
  return (
    <main>
      <HeroSection />
      <MissionSection />
      <ValidationSection />
      <PipelineSection />
      <TeamSection />
      <ProductsSection />
    </main>
  );
}
