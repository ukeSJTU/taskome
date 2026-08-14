import Link from "next/link";

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

export function ValidationSection() {
  return (
    <section id="platform" className="mx-auto max-w-4xl px-6 py-24">
      <h2 className="font-display text-3xl font-semibold text-ink md:text-4xl">
        Validated across five therapeutic domains.
      </h2>
      <p className="font-copy mt-4 max-w-2xl text-ink-muted">
        Cross-dimensional de novo design against innovative targets, each case producing
        high-affinity candidate molecules and confirming design accuracy in complex biological
        space.
      </p>

      <div className="mt-12 divide-y divide-bio-200 border-y border-bio-200">
        {CASES.map((item) => (
          <div
            key={item.domain}
            className="grid gap-2 py-6 md:grid-cols-[1.4fr_2fr_1fr] md:items-center md:gap-6"
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
      <Link
        href="/platform-cases"
        className="font-copy mt-8 inline-block text-sm font-medium text-ink-muted transition-colors hover:text-bio-700"
      >
        View all platform cases →
      </Link>
    </section>
  );
}
