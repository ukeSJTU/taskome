import type { Metadata } from "next";

import { HeroSection } from "@/components/public/hero-section";
import { MissionSection } from "@/components/public/mission-section";
import { PipelineSection } from "@/components/public/pipeline-section";
import { ProductsSection } from "@/components/public/products-section";
import { TeamSection } from "@/components/public/team-section";
import { ValidationSection } from "@/components/public/validation-section";

export const metadata: Metadata = {
  title: "XDeNovo — AI-designed peptides and proteins",
  description:
    "XDeNovo designs de novo peptides and proteins from scratch with AI, validated at the molecular interface.",
};

export default function Home() {
  return (
    <main>
      <HeroSection />
      <MissionSection />
      <ValidationSection />
      <PipelineSection />
      <TeamSection />
      <ProductsSection />
    </main>
  );
}
