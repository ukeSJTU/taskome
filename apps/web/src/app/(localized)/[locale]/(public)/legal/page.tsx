import type { Metadata } from "next";
import { useLocale, useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";

import { publicPageMetadata } from "@/i18n/metadata";
import { resolveAppLocale } from "@/i18n/routing";

const sectionKeys = [
  ["section1Title", "section1Body"],
  ["section2Title", "section2Body"],
  ["section3Title", "section3Body"],
  ["section4Title", "section4Body"],
  ["section5Title", "section5Body"],
  ["section6Title", "section6Body"],
  ["section7Title", "section7Body"],
] as const;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/legal">): Promise<Metadata> {
  const locale = resolveAppLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "Legal" });
  return publicPageMetadata({
    locale,
    pathname: "/legal",
    title: t("metadataTitle"),
    description: t("metadataDescription"),
  });
}

export default function LegalPage() {
  const t = useTranslations("Legal");
  const locale = useLocale();
  const sections = sectionKeys.map(([title, body]) => ({ title: t(title), body: t(body) }));

  return (
    <main className="mx-auto max-w-3xl px-6 py-24">
      <h1 className="font-display text-3xl font-semibold text-ink md:text-4xl">{t("title")}</h1>
      {locale === "zh-CN" ? (
        <p className="font-copy mt-4 rounded-md border border-bio-200 bg-bio-50 p-4 text-sm text-ink-muted">
          {t("translationNotice")}
        </p>
      ) : null}
      <p className="font-copy mt-6 leading-relaxed text-ink-muted">{t("intro")}</p>
      <p className="font-copy mt-4 leading-relaxed text-ink-muted">{t("updates")}</p>

      <div className="mt-12 divide-y divide-bio-200 border-y border-bio-200">
        {sections.map((section) => (
          <section key={section.title} className="py-7">
            <h2 className="font-display text-lg font-medium text-ink">{section.title}</h2>
            <p className="font-copy mt-2 leading-relaxed text-ink-muted">{section.body}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
