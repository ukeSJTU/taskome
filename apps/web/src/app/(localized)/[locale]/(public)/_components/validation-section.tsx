import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

export function ValidationSection() {
  const t = useTranslations("Home");
  const cases = [
    {
      domain: t("cases.metabolicDomain"),
      description: t("cases.metabolicDescription"),
      metric: t("cases.metabolicMetric"),
    },
    {
      domain: t("cases.tumorDomain"),
      description: t("cases.tumorDescription"),
      metric: t("cases.tumorMetric"),
    },
    {
      domain: t("cases.neuroDomain"),
      description: t("cases.neuroDescription"),
      metric: t("cases.neuroMetric"),
    },
    {
      domain: t("cases.autoimmuneDomain"),
      description: t("cases.autoimmuneDescription"),
      metric: t("cases.autoimmuneMetric"),
    },
    {
      domain: t("cases.cardioDomain"),
      description: t("cases.cardioDescription"),
      metric: t("cases.cardioMetric"),
    },
  ];

  return (
    <section id="platform" className="mx-auto max-w-4xl px-6 py-24">
      <h2 className="font-display text-3xl font-semibold text-ink md:text-4xl">
        {t("validationTitle")}
      </h2>
      <p className="font-copy mt-4 max-w-2xl text-ink-muted">{t("validationDescription")}</p>

      <div className="mt-12 divide-y divide-bio-200 border-y border-bio-200">
        {cases.map((item) => (
          <div
            key={item.domain}
            className="grid gap-2 py-6 md:grid-cols-[1.4fr_2fr_1fr] md:items-center md:gap-6"
          >
            <p className="font-display text-lg font-medium text-ink">{item.domain}</p>
            <p className="font-copy text-sm text-ink-muted">{item.description}</p>
            <p className="font-data text-sm font-medium text-signal-ink md:text-right">
              {item.metric}
            </p>
          </div>
        ))}
      </div>
      <p className="font-copy mt-4 text-xs text-ink-muted">{t("validationFootnote")}</p>
      <Link
        href="/platform-cases"
        className="font-copy mt-8 inline-block text-sm font-medium text-ink-muted transition-colors hover:text-bio-700"
      >
        {t("validationLink")}
      </Link>
    </section>
  );
}
