const PRODUCTS = [
  {
    name: "De novo peptide & antibody design",
    description:
      "Therapeutic peptides and antibodies engineered for high affinity, high specificity, and low immunogenicity, for biopharmaceutical development.",
    cycle: "20–30 wks",
  },
  {
    name: "PDC / PRC targeting heads",
    description:
      "High-affinity peptide targeting heads built on our de novo design capability, for PDC and PRC drug modalities.",
    cycle: "15–20 wks",
  },
  {
    name: "Antimicrobial peptides",
    description:
      "Novel antimicrobial peptides targeting plant pathogens, for effective control of bacterial disease in agriculture.",
    cycle: "15–20 wks",
  },
  {
    name: "Cosmetic peptides",
    description:
      "Bioactive peptides with improved stability and biocompatibility at pharmaceutical-grade precision, for cosmetic formulation.",
    cycle: "16–20 wks",
  },
  {
    name: "Industrial enzymes",
    description:
      "De novo designed enzymes engineered for catalytic efficiency and stability, for industrial-scale reactions.",
    cycle: "Custom",
  },
  {
    name: "Custom protein design",
    description:
      "Functional proteins designed to customer specification, with full-process technical support, for bespoke applications.",
    cycle: "By scope",
  },
] as const;

export function ProductsIndexSection() {
  return (
    <section className="mx-auto max-w-4xl px-6 pb-24">
      <div className="divide-y divide-bio-200 border-y border-bio-200">
        {PRODUCTS.map((product) => (
          <div
            key={product.name}
            className="grid gap-2 py-7 md:grid-cols-[1.6fr_2.2fr_0.8fr] md:items-center md:gap-6"
          >
            <p className="font-display text-lg font-medium text-ink">{product.name}</p>
            <p className="font-copy text-sm leading-relaxed text-ink-muted">
              {product.description}
            </p>
            <p className="font-copy text-sm font-medium text-ink-muted md:text-right">
              {product.cycle}
            </p>
          </div>
        ))}
      </div>
      <p className="font-copy mt-4 text-xs text-ink-muted">
        Design cycles are internal estimates of time from target definition to a validated
        candidate; final timelines depend on the design team&rsquo;s assessment of a specific
        project.
      </p>
    </section>
  );
}
