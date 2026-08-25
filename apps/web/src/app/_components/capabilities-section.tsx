import { SectionHeading } from "@/app/_components/section-heading";

const capabilities = [
  {
    index: "01",
    title: "De novo peptide and antibody design",
    description:
      "AI-based de novo design for therapeutic peptides or antibodies, shaped around affinity, specificity, and immunogenicity goals.",
    field: "Biopharmaceutical",
  },
  {
    index: "02",
    title: "PDC and PRC targeting heads",
    description:
      "High-affinity peptide targeting-head design for peptide–drug and peptide–radionuclide conjugates.",
    field: "Targeted therapeutics",
  },
  {
    index: "03",
    title: "Antimicrobial peptides",
    description:
      "Novel antimicrobial-peptide design for plant pathogens and the control of bacterial crop diseases.",
    field: "Agriculture",
  },
  {
    index: "04",
    title: "Cosmetic peptides",
    description:
      "Bioactive peptide design with stability, biocompatibility, and pharmaceutical-grade precision in view.",
    field: "Cosmetic science",
  },
  {
    index: "05",
    title: "Custom protein design",
    description:
      "Custom functional-protein design shaped around the scientific requirements of each program.",
    field: "Custom research",
  },
] as const;

export function CapabilitiesSection() {
  return (
    <section
      id="capabilities"
      className="capabilities-section"
      aria-labelledby="capabilities-title"
    >
      <div className="section-shell">
        <SectionHeading
          index="05"
          label="Capabilities"
          summary="Alongside Taskome, XDenovo applies computational biology and artificial intelligence to peptide and protein design programs."
          title="Scientific depth beyond the platform."
          titleId="capabilities-title"
        />

        <ol className="capability-list">
          {capabilities.map((capability) => (
            <li key={capability.index}>
              <span className="capability-list__index">{capability.index}</span>
              <h3>{capability.title}</h3>
              <p>{capability.description}</p>
              <span className="capability-list__field">{capability.field}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
