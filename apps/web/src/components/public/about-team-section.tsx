export function AboutTeamSection() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-24">
      <h2 className="font-display text-3xl font-semibold text-ink md:text-4xl">
        Built by people who have designed proteins before AI made it fast.
      </h2>
      <p className="font-copy mt-6 text-lg leading-relaxed text-ink-muted">
        XDeNovo was founded in 2025 by a core team from David Baker&rsquo;s laboratory and Shanghai
        Jiao Tong University, bringing years of hands-on peptide and protein engineering to a
        company built around a self-evolving design engine. The lab experience sets the standard the
        model is held to; the model is what lets that standard scale.
      </p>
      <p className="font-copy mt-4 text-lg leading-relaxed text-ink-muted">
        That split runs through how the company works: wet-lab discipline decides what
        &ldquo;good&rdquo; looks like — binding affinity, developability, manufacturability — and
        the AI engine is trained and re-trained against exactly that bar, using every assay result
        that comes back from the bench, not just what's in public structure databases.
      </p>
    </section>
  );
}
