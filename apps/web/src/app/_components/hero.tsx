import { ScientificVisual } from "@/app/_components/scientific-visual";

type HeroProps = {
  signInHref: string;
};

export function Hero({ signInHref }: HeroProps) {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero__grid">
        <div className="hero__copy">
          <p className="editorial-label">XDenovo / AI-native biotech</p>
          <h1 id="hero-title">Protein design, made reproducible.</h1>
          <p className="hero__deck">
            XDenovo builds scientific products for protein design. Taskome, our flagship platform,
            turns curated compute into durable, repeatable research work.
          </p>
          <div className="hero__action-row">
            <a className="signal-action signal-action--hero" href={signInHref}>
              Sign in
            </a>
            <p>
              <span>Flagship product</span>
              <strong>Taskome</strong>
            </p>
          </div>
        </div>

        <ScientificVisual />
      </div>

      <div className="hero__footer" aria-label="Taskome principles">
        <p>Curated tools</p>
        <p>Immutable jobs</p>
        <p>Durable provenance</p>
        <p className="hero__folio">XD / 01</p>
      </div>
    </section>
  );
}
