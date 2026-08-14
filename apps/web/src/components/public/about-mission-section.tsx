export function AboutMissionSection() {
  return (
    <section className="border-t border-bio-200 bg-bio-50/60">
      <div className="mx-auto grid max-w-4xl gap-12 px-6 py-24 md:grid-cols-2">
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">Mission</h2>
          <p className="font-copy mt-4 leading-relaxed text-ink-muted">
            Accelerate drug development with AI-designed novel peptides, reaching difficult-to-drug
            targets and unmet clinical needs that conventional discovery cannot economically reach.
          </p>
          <p className="font-copy mt-4 leading-relaxed text-ink-muted">
            We believe AI-driven peptide design will change how new drugs get made — not by
            replacing the bench, but by closing the loop between it and the model faster than either
            could alone.
          </p>
        </div>
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">Vision</h2>
          <p className="font-copy mt-4 leading-relaxed text-ink-muted">
            To lead the future of drug development with AI-driven peptide and protein design — an
            AI-native biotech company, built from the ground up around a self-evolving design engine
            rather than a conventional discovery pipeline with AI bolted on.
          </p>
        </div>
      </div>
    </section>
  );
}
