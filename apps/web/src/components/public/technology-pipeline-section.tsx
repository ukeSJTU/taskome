const STAGES = [
  {
    title: "Sequence generation",
    description:
      "A deep learning sequence architecture, trained on a large corpus of peptide structures, generates amino-acid sequences conditioned on a target's binding-site properties.",
    features: "High structural accuracy of every designed sequence.",
  },
  {
    title: "Structure prediction",
    description:
      "An attention-based architecture predicts peptide structure at a precision approaching experimental methods, in a fraction of the time.",
    features: "Every prediction ships with a confidence score.",
  },
  {
    title: "Performance optimization",
    description:
      "Multi-objective optimization — reinforcement learning and Bayesian search over a physics-based stability function and a learned activity model — improves stability and activity together, not one at the other's expense.",
    features: "Optimizes multiple biological properties simultaneously.",
  },
  {
    title: "Functional validation",
    description:
      "GPU-accelerated molecular dynamics, protein–protein and protein–ligand docking, and energy-landscape analysis validate a candidate in silico before it reaches the bench.",
    features: "Aggregation and immunogenicity risk are screened before synthesis.",
  },
] as const;

export function TechnologyPipelineSection() {
  return (
    <section className="border-t border-bio-200 bg-bio-900 text-paper">
      <div className="mx-auto max-w-4xl px-6 py-24">
        <h2 className="font-display text-3xl font-semibold md:text-4xl">
          Four stages, one closed design loop.
        </h2>
        <div className="mt-12 divide-y divide-bio-700 border-y border-bio-700">
          {STAGES.map((stage) => (
            <div key={stage.title} className="py-7">
              <p className="font-display text-lg font-medium">{stage.title}</p>
              <p className="font-copy mt-2 max-w-2xl text-sm leading-relaxed text-bio-100/80">
                {stage.description}
              </p>
              <p className="font-copy mt-1 max-w-2xl text-sm leading-relaxed text-bio-100/60">
                {stage.features}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
