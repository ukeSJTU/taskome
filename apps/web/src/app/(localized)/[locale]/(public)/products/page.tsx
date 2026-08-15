import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";

import { PageHero } from "@/app/(localized)/[locale]/(public)/_components/page-hero";
import { ProductsIndexSection } from "@/app/(localized)/[locale]/(public)/_components/products-index-section";
import { publicPageMetadata } from "@/i18n/metadata";
import { resolveAppLocale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/products">): Promise<Metadata> {
  const locale = resolveAppLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "ProductsPage" });
  return publicPageMetadata({
    locale,
    pathname: "/products",
    title: t("metadataTitle"),
    description: t("metadataDescription"),
  });
}

export default function ProductsPage() {
  const t = useTranslations("ProductsPage");

  return (
    <main>
      <PageHero title={t("heroTitle")} subtitle={t("heroSubtitle")} />
      <ProductsIndexSection />
    </main>
  );
}
