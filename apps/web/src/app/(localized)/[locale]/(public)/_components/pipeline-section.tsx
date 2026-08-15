import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

export function PipelineSection() {
  const t = useTranslations("Home");
  const stages = [
    { label: t("pipeline.targetLabel"), detail: t("pipeline.targetDetail") },
    { label: t("pipeline.generationLabel"), detail: t("pipeline.generationDetail") },
    { label: t("pipeline.validationLabel"), detail: t("pipeline.validationDetail") },
    { label: t("pipeline.feedbackLabel"), detail: t("pipeline.feedbackDetail") },
  ];

  return (
    <section className="border-t border-bio-200 bg-bio-900 text-paper">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <h2 className="font-display text-3xl font-semibold md:text-4xl">{t("pipelineTitle")}</h2>
        <ol className="mt-14 grid gap-10 md:grid-cols-4">
          {stages.map((stage, index) => (
            <li key={stage.label} className="relative pl-10 md:pl-0">
              <div className="flex items-center gap-3 md:flex-col md:items-start md:gap-4">
                <span className="font-data flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-bio-500 text-sm text-bio-200">
                  {index + 1}
                </span>
                <div className="h-px flex-1 bg-bio-700 md:hidden" aria-hidden />
              </div>
              <div className="hidden h-px w-full bg-bio-700 md:mt-4 md:mb-4 md:block" aria-hidden />
              <p className="font-display mt-3 text-lg font-medium md:mt-0">{stage.label}</p>
              <p className="font-copy mt-2 text-sm leading-relaxed text-bio-100/80">
                {stage.detail}
              </p>
            </li>
          ))}
        </ol>
        <Link
          href="/technology"
          className="font-copy mt-12 inline-block text-sm font-medium text-bio-200 transition-colors hover:text-paper"
        >
          {t("pipelineLink")}
        </Link>
      </div>
    </section>
  );
}
