import { useTranslations } from "next-intl";

export function AboutMissionSection() {
  const t = useTranslations("About");

  return (
    <section className="border-t border-bio-200 bg-bio-50/60">
      <div className="mx-auto grid max-w-4xl gap-12 px-6 py-24 md:grid-cols-2">
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">{t("missionHeading")}</h2>
          <p className="font-copy mt-4 leading-relaxed text-ink-muted">{t("missionBodyOne")}</p>
          <p className="font-copy mt-4 leading-relaxed text-ink-muted">{t("missionBodyTwo")}</p>
        </div>
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">{t("visionHeading")}</h2>
          <p className="font-copy mt-4 leading-relaxed text-ink-muted">{t("visionBody")}</p>
        </div>
      </div>
    </section>
  );
}
