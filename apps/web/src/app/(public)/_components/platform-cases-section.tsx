const CASES = [
  {
    domain: "Metabolic diseases",
    description: "High-affinity binders against metabolic regulation targets.",
    metric: "nM-level affinity",
  },
  {
    domain: "Tumor immunity",
    description: "Structural innovation on immune checkpoint inhibitors.",
    metric: "100% structural originality",
  },
  {
    domain: "Neurodegenerative diseases",
    description: "Candidates engineered for blood–brain-barrier penetration.",
    metric: "AI-optimized stability",
  },
  {
    domain: "Autoimmune diseases",
    description: "Precise targeting of cytokine signaling pathways.",
    metric: "High-specificity binding",
  },
  {
    domain: "Cardiovascular diseases",
    description: "Stability and bioactivity sustained across the circulatory system.",
    metric: "Long half-life design",
  },
] as const;

export function PlatformCasesSection() {
  return (
    <section className="mx-auto max-w-4xl px-6 pb-24">
      <div className="divide-y divide-bio-200 border-y border-bio-200">
        {CASES.map((item) => (
          <div
            key={item.domain}
            className="grid gap-2 py-7 md:grid-cols-[1.4fr_2fr_1fr] md:items-center md:gap-6"
          >
            <p className="font-display text-lg font-medium text-ink">{item.domain}</p>
            <p className="font-copy text-sm text-ink-muted">{item.description}</p>
            <p className="font-data text-sm font-medium text-signal-ink md:text-right">
              {item.metric}
            </p>
          </div>
        ))}
      </div>
      <p className="font-copy mt-4 text-xs text-ink-muted">
        Figures reflect internal experimental data and process comparisons.
      </p>
    </section>
  );
}
