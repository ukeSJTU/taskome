import { useTranslations } from "next-intl";

export function TechnologyPipelineSection() {
  const t = useTranslations("Technology");
  const stages = [
    {
      title: t("sequenceTitle"),
      description: t("sequenceDescription"),
      features: t("sequenceFeature"),
    },
    {
      title: t("structureTitle"),
      description: t("structureDescription"),
      features: t("structureFeature"),
    },
    {
      title: t("optimizationTitle"),
      description: t("optimizationDescription"),
      features: t("optimizationFeature"),
    },
    {
      title: t("validationTitle"),
      description: t("validationDescription"),
      features: t("validationFeature"),
    },
  ];

  return (
    <section className="border-t border-bio-200 bg-bio-900 text-paper">
      <div className="mx-auto max-w-4xl px-6 py-24">
        <h2 className="font-display text-3xl font-semibold md:text-4xl">{t("pipelineTitle")}</h2>
        <div className="mt-12 divide-y divide-bio-700 border-y border-bio-700">
          {stages.map((stage) => (
            <div key={stage.title} className="py-7">
              <p className="font-display text-lg font-medium">{stage.title}</p>
              <p className="font-copy mt-2 max-w-2xl text-sm leading-relaxed text-bio-100/80">
                {stage.description}
              </p>
              <p className="font-copy mt-1 max-w-2xl text-sm leading-relaxed text-bio-100/60">
                {stage.features}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
