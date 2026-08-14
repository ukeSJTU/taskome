const MILESTONES = [
  { year: "2018", event: "AlphaFold demonstrates deep learning can predict protein structure." },
  { year: "2021", event: "AlphaFold2 reaches near-experimental structure prediction accuracy." },
  { year: "2022", event: "The first AI-designed antibody enters clinical trials." },
  { year: "2023", event: "RFdiffusion opens de novo protein generation to the field at large." },
  {
    year: "2024",
    event: "The Nobel Prize in Chemistry recognizes computational protein design.",
  },
  { year: "2025", event: "XDeNovo is founded to bring that shift to peptide and protein drugs." },
] as const;

export function AboutTimelineSection() {
  return (
    <section className="border-t border-bio-200 bg-bio-50/60">
      <div className="mx-auto max-w-3xl px-6 py-24">
        <h2 className="font-display text-2xl font-semibold text-ink">
          Why now: a field that moved fast enough to found a company on.
        </h2>
        <div className="mt-10 divide-y divide-bio-200 border-y border-bio-200">
          {MILESTONES.map((item) => (
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
