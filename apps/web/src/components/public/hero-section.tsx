import { BinderIllustration } from "./binder-illustration";

export function HeroSection() {
  return (
    <section className="mx-auto grid max-w-6xl gap-12 px-6 pt-16 pb-24 md:grid-cols-2 md:items-center md:pt-24">
      <div>
        <h1 className="font-display max-w-lg text-4xl leading-[1.08] font-semibold tracking-tight text-ink md:text-5xl">
          We design the molecule that binds — not the one that merely predicts.
        </h1>
        <p className="font-copy mt-6 max-w-md text-lg leading-relaxed text-ink-muted">
          XDeNovo designs de novo peptides and proteins from scratch with AI, and validates every
          candidate at the molecular interface where it actually has to work.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-6">
          <a
            href="#platform"
            className="font-copy rounded-full bg-signal-700 px-6 py-3 text-sm font-medium text-paper transition-colors hover:bg-signal-800"
          >
            See platform validation
          </a>
          <a
            href="#mission"
            className="font-copy text-sm font-medium text-ink-muted transition-colors hover:text-bio-700"
          >
            Read our approach →
          </a>
        </div>
      </div>
      <div className="relative aspect-square w-full max-w-md justify-self-center md:justify-self-end">
        <BinderIllustration />
      </div>
    </section>
  );
}
