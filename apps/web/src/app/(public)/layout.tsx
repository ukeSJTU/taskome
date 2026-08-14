import { Archivo, Inter } from "next/font/google";

import { PublicSiteHeader } from "@/app/(public)/_components/site-header";
import { PublicSiteFooter } from "@/app/(public)/_components/site-footer";

const displayFont = Archivo({
  variable: "--font-display-src",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const copyFont = Inter({
  variable: "--font-copy-src",
  subsets: ["latin"],
});

const DIRECTION_CONTRACT = `<!--
THESIS: XDeNovo designs real binder proteins with AI; the homepage proves the mechanism in the first viewport instead of restating "AI biotech" as a mood.
OWN-WORLD: warm lab-white ground, committed layered bio-green (30-60% coverage per section), signal orange reserved for the binding interface and primary CTAs only; Archivo display type paired with Inter body copy and monospace reserved for real data (validation metrics).
STORY: a biology researcher understands XDeNovo actually designs functional binders with concrete validated results, not just AI-biotech branding, and can find the mechanism, proof, team, and products within seconds.
FIRST VIEWPORT: an authored ribbon-diagram illustration of a designed binder locking onto a target's binding interface, rendered in bio-green with the interface itself highlighted in signal orange, beside a two-line editorial headline and a single primary CTA.
FORM: user-pinned direction (lab-white base, layered bio-green, sparing orange signal, referencing profluent.bio / provolut.bio / tamarind.bio) fused with structural-biology visualization grounding; brief-pinned direction, no concept-seed roll run.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md.
-->`;

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${displayFont.variable} ${copyFont.variable} xdenovo-public bg-lab text-ink`}>
      <div
        style={{ display: "contents" }}
        dangerouslySetInnerHTML={{ __html: DIRECTION_CONTRACT }}
      />
      <PublicSiteHeader />
      {children}
      <PublicSiteFooter />
    </div>
  );
}
