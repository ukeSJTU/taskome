import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

export function ProductsSection() {
  const t = useTranslations("Home");
  const products = [
    { name: t("products.peptideName"), description: t("products.peptideDescription") },
    { name: t("products.pdcName"), description: t("products.pdcDescription") },
    { name: t("products.antimicrobialName"), description: t("products.antimicrobialDescription") },
    { name: t("products.cosmeticName"), description: t("products.cosmeticDescription") },
    { name: t("products.enzymeName"), description: t("products.enzymeDescription") },
    { name: t("products.customName"), description: t("products.customDescription") },
  ];

  return (
    <section id="products" className="border-t border-bio-200">
      <div className="mx-auto max-w-4xl px-6 py-24">
        <h2 className="font-display text-3xl font-semibold text-ink md:text-4xl">
          {t("productsTitle")}
        </h2>
        <div className="mt-12 divide-y divide-bio-200">
          {products.map((product) => (
            <div key={product.name} className="py-7">
              <p className="font-display text-lg font-medium text-ink">{product.name}</p>
              <p className="font-copy mt-1.5 max-w-xl text-sm leading-relaxed text-ink-muted">
                {product.description}
              </p>
            </div>
          ))}
        </div>
        <Link
          href="/products"
          className="font-copy mt-8 inline-block text-sm font-medium text-ink-muted transition-colors hover:text-bio-700"
        >
          {t("productsLink")}
        </Link>
      </div>
    </section>
  );
}
