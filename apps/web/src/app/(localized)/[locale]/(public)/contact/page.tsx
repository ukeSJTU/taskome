import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";

import { ContactInfoSection } from "@/app/(localized)/[locale]/(public)/_components/contact-info-section";
import { PageHero } from "@/app/(localized)/[locale]/(public)/_components/page-hero";
import { publicPageMetadata } from "@/i18n/metadata";
import { resolveAppLocale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/contact">): Promise<Metadata> {
  const locale = resolveAppLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "Contact" });
  return publicPageMetadata({
    locale,
    pathname: "/contact",
    title: t("metadataTitle"),
    description: t("metadataDescription"),
  });
}

export default function ContactPage() {
  const t = useTranslations("Contact");

  return (
    <main>
      <PageHero title={t("heroTitle")} subtitle={t("heroSubtitle")} />
      <ContactInfoSection />
    </main>
  );
}
