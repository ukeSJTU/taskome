import { useTranslations } from "next-intl";

export function PlatformCasesStatsSection() {
  const t = useTranslations("PlatformCases");
  const stats = [
    { value: "5+", label: t("diseaseAreas") },
    { value: "nM", label: t("affinityLevel") },
    { value: "100%", label: t("structuralOriginality") },
    { value: "AI", label: t("optimizedDesign") },
  ];

  return (
    <section className="border-t border-bio-200 bg-bio-50/60">
      <div className="mx-auto max-w-4xl px-6 py-16">
        <div className="grid grid-cols-2 divide-y divide-bio-200 border-y border-bio-200 md:grid-cols-4 md:divide-x md:divide-y-0">
          {stats.map((stat) => (
            <div key={stat.label} className="py-6 text-center md:px-4">
              <p className="font-data text-2xl font-medium text-bio-700 md:text-3xl">
                {stat.value}
              </p>
              <p className="font-copy mt-1 text-xs text-ink-muted">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
