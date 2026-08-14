const ADVANTAGES = [
  {
    title: "Higher success rate",
    description:
      "Proprietary generation and validation algorithms lift prediction and design success rates well above traditional discovery methods.",
  },
  {
    title: "Self-evolution",
    description:
      "Models keep learning from experimental outcomes, not only from public structure databases — every assay result closes the loop.",
  },
  {
    title: "Massive design space",
    description:
      "De novo generation explores a design space far larger than scaffold-library or homology-based approaches can reach.",
  },
  {
    title: "Faster iteration",
    description: "Design cycles compress from years to weeks, without trading away accuracy.",
  },
] as const;

export function TechnologyAdvantagesSection() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-24">
      <h2 className="font-display text-3xl font-semibold text-ink md:text-4xl">
        Where the AI-driven approach pulls ahead.
      </h2>
      <div className="mt-12 divide-y divide-bio-200 border-y border-bio-200">
        {ADVANTAGES.map((advantage) => (
          <div key={advantage.title} className="py-7">
            <p className="font-display text-lg font-medium text-ink">{advantage.title}</p>
            <p className="font-copy mt-1.5 max-w-xl text-sm leading-relaxed text-ink-muted">
              {advantage.description}
            </p>
          </div>
        ))}
      </div>
      <p className="font-copy mt-4 text-xs text-ink-muted">
        Note: figures above reflect internal experimental data and process comparisons.
      </p>
    </section>
  );
}
