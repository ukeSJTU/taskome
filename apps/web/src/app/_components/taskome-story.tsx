import { SectionHeading } from "@/app/_components/section-heading";

const computeRecord = [
  { index: "01", name: "Tool", detail: "A curated compute capability" },
  { index: "02", name: "Job", detail: "The immutable request" },
  { index: "03", name: "Attempt", detail: "One execution try" },
  { index: "04", name: "Job Output", detail: "A published result file" },
] as const;

const researchContext = [
  { label: "Project", detail: "Organizes related private research work." },
  { label: "Scientific files", detail: "Remain available as inputs, references, and outputs." },
  { label: "Utility", detail: "Views or edits a file in the browser without creating a Job." },
] as const;

export function TaskomeStory() {
  return (
    <section id="taskome" className="taskome-section" aria-labelledby="taskome-title">
      <div className="section-shell">
        <div className="taskome-section__masthead" aria-hidden="true">
          <span>Taskome</span>
          <span>Flagship / 01</span>
        </div>

        <SectionHeading
          index="03"
          label="Taskome"
          summary="Taskome is XDenovo's platform for running, managing, and reproducing protein-design compute. It keeps the request, execution history, files, and research context legible as one durable record."
          title="One model for the whole compute lifecycle."
          titleId="taskome-title"
        />

        <div className="taskome-model">
          <div>
            <p className="taskome-model__label">Compute record</p>
            <ol className="domain-flow">
              {computeRecord.map((concept) => (
                <li key={concept.name}>
                  <span>{concept.index}</span>
                  <strong>{concept.name}</strong>
                  <p>{concept.detail}</p>
                </li>
              ))}
            </ol>
          </div>

          <aside className="research-context" aria-labelledby="research-context-title">
            <p className="taskome-model__label" id="research-context-title">
              Research context
            </p>
            <dl>
              {researchContext.map((concept) => (
                <div key={concept.label}>
                  <dt>{concept.label}</dt>
                  <dd>{concept.detail}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>

        <p className="taskome-section__outcome">
          The researcher stays responsible for scientific judgment. Taskome makes the compute facts
          available to inspect, compare, and reproduce.
        </p>
      </div>
    </section>
  );
}
