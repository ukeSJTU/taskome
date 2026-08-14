import type { Metadata } from "next";

import { ContactInfoSection } from "../_components/contact-info-section";
import { PageHero } from "../_components/page-hero";

export const metadata: Metadata = {
  title: "Contact — XDeNovo",
  description:
    "Reach the XDeNovo team — R&D presence in Shanghai, Beijing, Hong Kong, and Seattle.",
};

export default function ContactPage() {
  return (
    <main>
      <PageHero
        title="Let's talk about the target you can't reach yet."
        subtitle="See how AI-designed peptides and proteins can help with the problem conventional discovery hasn't cracked."
      />
      <ContactInfoSection />
    </main>
  );
}
