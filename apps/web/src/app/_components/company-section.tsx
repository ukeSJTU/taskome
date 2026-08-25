import { SectionHeading } from "@/app/_components/section-heading";

const companyFacts = [
  {
    label: "Mission",
    text: "Accelerate drug development through AI-designed novel peptides and address difficult-to-drug targets and unmet clinical needs.",
  },
  {
    label: "Background",
    text: "Our core team brings experience from the David Baker Laboratory and Shanghai Jiao Tong University, combining computational biology, peptide engineering, and artificial intelligence.",
  },
  {
    label: "Presence",
    text: "Headquartered in Shanghai, with R&D presence across Shanghai, Beijing, Hong Kong, and Seattle.",
  },
] as const;

export function CompanySection() {
  return (
    <section id="company" className="company-section" aria-labelledby="company-title">
      <div className="section-shell">
        <SectionHeading
          index="06"
          label="Company"
          summary="XDenovo is building an AI-native biotechnology company around durable scientific products and deep peptide-design expertise."
          title="Computational biology, built into the way research works."
          titleId="company-title"
        />

        <div className="company-statement">
          <p>From algorithms to research operations.</p>
          <p>
            We combine modern artificial intelligence with years of peptide engineering experience
            to work on challenging problems across pharmaceutical, industrial, and synthetic
            biology.
          </p>
        </div>

        <dl className="company-facts">
          {companyFacts.map((fact, index) => (
            <div key={fact.label}>
              <dt>
                <span>{String(index + 1).padStart(2, "0")}</span>
                {fact.label}
              </dt>
              <dd>{fact.text}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
