export function MissionSection() {
  return (
    <section id="mission" className="border-t border-bio-200 bg-bio-50/60">
      <div className="mx-auto max-w-3xl px-6 py-24">
        <h2 className="font-display text-3xl leading-tight font-semibold text-ink md:text-4xl">
          Grounded in structural biology. Authored by artificial intelligence.
        </h2>
        <p className="font-copy mt-6 text-lg leading-relaxed text-ink-muted">
          XDeNovo accelerates drug development by designing novel peptides and proteins with AI —
          reaching difficult-to-drug targets and unmet clinical needs that conventional discovery
          cannot economically reach.
        </p>
        <p className="font-copy mt-4 text-lg leading-relaxed text-ink-muted">
          Our core team combines peptide engineering experience from David Baker&rsquo;s laboratory
          and Shanghai Jiao Tong University with a self-evolving AI design engine that learns
          directly from experimental outcomes, not just from public structure databases.
        </p>
      </div>
    </section>
  );
}
