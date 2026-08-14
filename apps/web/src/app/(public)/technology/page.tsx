import type { Metadata } from "next";

import { PageHero } from "@/components/public/page-hero";
import { TechnologyAdvantagesSection } from "@/components/public/technology-advantages-section";
import { TechnologyPipelineSection } from "@/components/public/technology-pipeline-section";

export const metadata: Metadata = {
  title: "Technology — XDeNovo",
  description:
    "The XDeNovo platform: sequence generation, structure prediction, performance optimization, and functional validation, in one closed AI design loop.",
};

export default function TechnologyPage() {
  return (
    <main>
      <PageHero
        title="An AI peptide design system built to lead, not follow."
        subtitle="From target definition to a validated candidate, every stage of the platform is designed to close the loop between generation and experimental evidence."
      />
      <TechnologyPipelineSection />
      <TechnologyAdvantagesSection />
    </main>
  );
}
