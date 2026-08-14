const STAGES = [
  {
    label: "Target definition",
    detail:
      "Binding site, developability constraints, and success criteria are set before generation starts.",
  },
  {
    label: "De novo generation",
    detail:
      "The AI engine proposes binder candidates from scratch, not from a fixed scaffold library.",
  },
  {
    label: "In silico validation",
    detail:
      "Structure, binding pose, and developability are predicted and ranked before synthesis.",
  },
  {
    label: "Experimental feedback",
    detail: "Assay results feed back into the model, closing a design–test–optimize loop.",
  },
] as const;

export function PipelineSection() {
  return (
    <section className="border-t border-bio-200 bg-bio-900 text-paper">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <h2 className="font-display text-3xl font-semibold md:text-4xl">
          A closed loop, not a one-shot prediction.
        </h2>
        <ol className="mt-14 grid gap-10 md:grid-cols-4">
          {STAGES.map((stage, index) => (
            <li key={stage.label} className="relative pl-10 md:pl-0">
              <div className="flex items-center gap-3 md:flex-col md:items-start md:gap-4">
                <span className="font-data flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-bio-500 text-sm text-bio-200">
                  {index + 1}
                </span>
                <div className="h-px flex-1 bg-bio-700 md:hidden" aria-hidden />
              </div>
              <div className="hidden h-px w-full bg-bio-700 md:mt-4 md:mb-4 md:block" aria-hidden />
              <p className="font-display mt-3 text-lg font-medium md:mt-0">{stage.label}</p>
              <p className="font-copy mt-2 text-sm leading-relaxed text-bio-100/80">
                {stage.detail}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
