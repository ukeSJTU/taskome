import type { Metadata } from "next";

import { PageHero } from "@/app/(public)/_components/page-hero";
import { PlatformCasesSection } from "@/app/(public)/_components/platform-cases-section";
import { PlatformCasesStatsSection } from "@/app/(public)/_components/platform-cases-stats-section";

export const metadata: Metadata = {
  title: "Platform Cases — XDeNovo",
  description:
    "Cross-dimensional de novo design against innovative targets in five therapeutic domains, each producing high-affinity candidate molecules and confirming design accuracy in complex biological space.",
};

export default function PlatformCasesPage() {
  return (
    <main>
      <PageHero
        title="Platform universality, validated across five therapeutic domains."
        subtitle="Based on the XDeNovo AI engine, we've achieved cross-dimensional de novo design for innovative targets across different disease areas — each case producing high-affinity candidate molecules and confirming design accuracy in complex biological space."
      />
      <PlatformCasesSection />
      <PlatformCasesStatsSection />
    </main>
  );
}
