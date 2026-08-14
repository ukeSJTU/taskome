import type { Metadata } from "next";

import { AboutMissionSection } from "../_components/about-mission-section";
import { AboutTeamSection } from "../_components/about-team-section";
import { AboutTimelineSection } from "../_components/about-timeline-section";
import { PageHero } from "../_components/page-hero";

export const metadata: Metadata = {
  title: "About — XDeNovo",
  description:
    "XDeNovo combines peptide engineering experience from David Baker's laboratory and Shanghai Jiao Tong University with a self-evolving AI design engine.",
};

export default function AboutPage() {
  return (
    <main>
      <PageHero
        title="Breakthrough AI peptide design, from computational biology experts."
        subtitle="Our core team comes from David Baker's laboratory and Shanghai Jiao Tong University, pairing years of hands-on peptide engineering with cutting-edge AI to solve hard problems in pharma, industrial, and synthetic biology."
      />
      <AboutMissionSection />
      <AboutTeamSection />
      <AboutTimelineSection />
    </main>
  );
}
