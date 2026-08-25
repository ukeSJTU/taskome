import { SectionHeading } from "@/app/_components/section-heading";

const principles = [
  {
    index: "01",
    title: "Curate the capability",
    description:
      "A Tool presents an intentional scientific workflow with named inputs, parameters, and outputs—not another environment to reconstruct.",
  },
  {
    index: "02",
    title: "Separate intent from execution",
    description:
      "A Job preserves the request. Every retry creates another Attempt, so execution history does not rewrite scientific intent.",
  },
  {
    index: "03",
    title: "Keep the context",
    description:
      "Projects and scientific files organize related work without forcing independent Jobs into an invented Pipeline.",
  },
] as const;

export function ApproachSection() {
  return (
    <section className="approach-section" aria-labelledby="approach-title">
      <div className="section-shell">
        <SectionHeading
          index="02"
          label="Approach"
          summary="Protein-design results depend on more than a model name. Inputs, parameters, environments, execution attempts, and outputs need to remain connected."
          title="Scientific compute should leave a record, not a mystery."
          titleId="approach-title"
        />

        <ol className="principle-list">
          {principles.map((principle) => (
            <li key={principle.index}>
              <span>{principle.index}</span>
              <div>
                <h3>{principle.title}</h3>
                <p>{principle.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
