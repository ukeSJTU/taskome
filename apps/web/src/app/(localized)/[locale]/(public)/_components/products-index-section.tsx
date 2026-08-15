import { useTranslations } from "next-intl";

export function ProductsIndexSection() {
  const home = useTranslations("Home.products");
  const page = useTranslations("ProductsPage");
  const products = [
    {
      name: home("peptideName"),
      description: home("peptideDescription"),
      cycle: page("peptideCycle"),
    },
    { name: home("pdcName"), description: home("pdcDescription"), cycle: page("pdcCycle") },
    {
      name: home("antimicrobialName"),
      description: home("antimicrobialDescription"),
      cycle: page("antimicrobialCycle"),
    },
    {
      name: home("cosmeticName"),
      description: home("cosmeticDescription"),
      cycle: page("cosmeticCycle"),
    },
    {
      name: home("enzymeName"),
      description: home("enzymeDescription"),
      cycle: page("enzymeCycle"),
    },
    {
      name: home("customName"),
      description: home("customDescription"),
      cycle: page("customCycle"),
    },
  ];

  return (
    <section className="mx-auto max-w-4xl px-6 pb-24">
      <div className="divide-y divide-bio-200 border-y border-bio-200">
        {products.map((product) => (
          <div
            key={product.name}
            className="grid gap-2 py-7 md:grid-cols-[1.6fr_2.2fr_0.8fr] md:items-center md:gap-6"
          >
            <p className="font-display text-lg font-medium text-ink">{product.name}</p>
            <p className="font-copy text-sm leading-relaxed text-ink-muted">
              {product.description}
            </p>
            <p className="font-copy text-sm font-medium text-ink-muted md:text-right">
              {product.cycle}
            </p>
          </div>
        ))}
      </div>
      <p className="font-copy mt-4 text-xs text-ink-muted">{page("footnote")}</p>
    </section>
  );
}
