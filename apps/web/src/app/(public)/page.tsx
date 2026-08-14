import type { Metadata } from "next";

import { HeroSection } from "@/app/(public)/_components/hero-section";
import { MissionSection } from "@/app/(public)/_components/mission-section";
import { PipelineSection } from "@/app/(public)/_components/pipeline-section";
import { ProductsSection } from "@/app/(public)/_components/products-section";
import { TeamSection } from "@/app/(public)/_components/team-section";
import { ValidationSection } from "@/app/(public)/_components/validation-section";

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
