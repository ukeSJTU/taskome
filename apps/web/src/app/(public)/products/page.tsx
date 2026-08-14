import type { Metadata } from "next";

import { PageHero } from "@/app/(public)/_components/page-hero";
import { ProductsIndexSection } from "@/app/(public)/_components/products-index-section";

export const metadata: Metadata = {
  title: "Products — XDeNovo",
  description:
    "One AI design engine, six molecule classes: therapeutic peptides and antibodies, PDC/PRC targeting heads, antimicrobial peptides, cosmetic peptides, industrial enzymes, and custom protein design.",
};

export default function ProductsPage() {
  return (
    <main>
      <PageHero
        title="One design engine, six molecule classes."
        subtitle="Comprehensive peptide and protein design across biopharmaceutical, agricultural, cosmetic, and industrial applications — built to break through the bottlenecks conventional discovery can't clear."
      />
      <ProductsIndexSection />
    </main>
  );
}
