import { useTranslations } from "next-intl";

export function MissionSection() {
  const t = useTranslations("Home");

  return (
    <section id="mission" className="border-t border-bio-200 bg-bio-50/60">
      <div className="mx-auto max-w-3xl px-6 py-24">
        <h2 className="font-display text-3xl leading-tight font-semibold text-ink md:text-4xl">
          {t("missionTitle")}
        </h2>
        <p className="font-copy mt-6 text-lg leading-relaxed text-ink-muted">
          {t("missionBodyOne")}
        </p>
        <p className="font-copy mt-4 text-lg leading-relaxed text-ink-muted">
          {t("missionBodyTwo")}
        </p>
      </div>
    </section>
  );
}
