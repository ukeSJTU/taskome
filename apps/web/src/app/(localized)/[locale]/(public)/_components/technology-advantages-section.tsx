import { useTranslations } from "next-intl";

export function TechnologyAdvantagesSection() {
  const t = useTranslations("Technology");
  const advantages = [
    { title: t("successTitle"), description: t("successDescription") },
    { title: t("evolutionTitle"), description: t("evolutionDescription") },
    { title: t("spaceTitle"), description: t("spaceDescription") },
    { title: t("speedTitle"), description: t("speedDescription") },
  ];

  return (
    <section className="mx-auto max-w-4xl px-6 py-24">
      <h2 className="font-display text-3xl font-semibold text-ink md:text-4xl">
        {t("advantagesTitle")}
      </h2>
      <div className="mt-12 divide-y divide-bio-200 border-y border-bio-200">
        {advantages.map((advantage) => (
          <div key={advantage.title} className="py-7">
            <p className="font-display text-lg font-medium text-ink">{advantage.title}</p>
            <p className="font-copy mt-1.5 max-w-xl text-sm leading-relaxed text-ink-muted">
              {advantage.description}
            </p>
          </div>
        ))}
      </div>
      <p className="font-copy mt-4 text-xs text-ink-muted">{t("footnote")}</p>
    </section>
  );
}
