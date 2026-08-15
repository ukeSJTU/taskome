export function PageHero({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <section className="mx-auto max-w-4xl px-6 pt-16 pb-20 md:pt-24">
      <h1 className="font-display max-w-2xl text-4xl leading-[1.08] font-semibold tracking-tight text-ink md:text-5xl">
        {title}
      </h1>
      <p className="font-copy mt-6 max-w-xl text-lg leading-relaxed text-ink-muted">{subtitle}</p>
    </section>
  );
}
