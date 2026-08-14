const PRODUCTS = [
  {
    name: "De novo peptide & antibody design",
    description:
      "Therapeutic peptides and antibodies engineered for high affinity, high specificity, and low immunogenicity, for biopharmaceutical development.",
  },
  {
    name: "PDC / PRC targeting heads",
    description:
      "High-affinity peptide targeting heads built on our de novo design capability, for PDC and PRC drug modalities.",
  },
  {
    name: "Antimicrobial peptides",
    description:
      "Novel antimicrobial peptides targeting plant pathogens, for bacterial disease control in agriculture.",
  },
  {
    name: "Cosmetic peptides",
    description:
      "Bioactive peptides with improved stability and biocompatibility at pharmaceutical-grade precision, for cosmetic formulation.",
  },
  {
    name: "Industrial enzymes",
    description:
      "De novo designed enzymes engineered for catalytic efficiency and stability, for industrial-scale reactions.",
  },
  {
    name: "Custom protein design",
    description:
      "Functional proteins designed to customer specification, with full-process technical support, for bespoke applications.",
  },
] as const;

export function ProductsSection() {
  return (
    <section id="products" className="border-t border-bio-200">
      <div className="mx-auto max-w-4xl px-6 py-24">
        <h2 className="font-display text-3xl font-semibold text-ink md:text-4xl">
          One design engine, six molecule classes.
        </h2>
        <div className="mt-12 divide-y divide-bio-200">
          {PRODUCTS.map((product) => (
            <div key={product.name} className="py-7">
              <p className="font-display text-lg font-medium text-ink">{product.name}</p>
              <p className="font-copy mt-1.5 max-w-xl text-sm leading-relaxed text-ink-muted">
                {product.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
