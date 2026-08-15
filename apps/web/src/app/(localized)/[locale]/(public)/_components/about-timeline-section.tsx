import { useTranslations } from "next-intl";

const milestoneKeys = [
  ["2018", "timeline2018"],
  ["2021", "timeline2021"],
  ["2022", "timeline2022"],
  ["2023", "timeline2023"],
  ["2024", "timeline2024"],
  ["2025", "timeline2025"],
] as const;

export function AboutTimelineSection() {
  const t = useTranslations("About");
  const milestones = milestoneKeys.map(([year, key]) => ({ year, event: t(key) }));

  return (
    <section className="border-t border-bio-200 bg-bio-50/60">
      <div className="mx-auto max-w-3xl px-6 py-24">
        <h2 className="font-display text-2xl font-semibold text-ink">{t("timelineTitle")}</h2>
        <div className="mt-10 divide-y divide-bio-200 border-y border-bio-200">
          {milestones.map((item) => (
            <div
              key={item.year}
              className="grid gap-1 py-5 md:grid-cols-[5rem_1fr] md:items-baseline md:gap-6"
            >
              <p className="font-display text-sm font-medium text-ink-muted">{item.year}</p>
              <p className="font-copy text-sm text-ink">{item.event}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
