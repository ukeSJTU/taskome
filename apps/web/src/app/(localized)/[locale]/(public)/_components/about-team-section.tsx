import { useTranslations } from "next-intl";

export function AboutTeamSection() {
  const t = useTranslations("About");

  return (
    <section className="mx-auto max-w-3xl px-6 py-24">
      <h2 className="font-display text-3xl font-semibold text-ink md:text-4xl">{t("teamTitle")}</h2>
      <p className="font-copy mt-6 text-lg leading-relaxed text-ink-muted">{t("teamBodyOne")}</p>
      <p className="font-copy mt-4 text-lg leading-relaxed text-ink-muted">{t("teamBodyTwo")}</p>
    </section>
  );
}
