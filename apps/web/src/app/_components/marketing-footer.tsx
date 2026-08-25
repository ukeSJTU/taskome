import { BrandMark } from "@/app/_components/brand-mark";
import { siteConfig } from "@/lib/site-config";

type MarketingFooterProps = {
  docsHref: string;
  navigation: {
    product: ReadonlyArray<{ href: string; label: string }>;
    company: ReadonlyArray<{ href: string; label: string }>;
  };
  signInHref: string;
};

export function MarketingFooter({ docsHref, navigation, signInHref }: MarketingFooterProps) {
  return (
    <footer className="marketing-footer">
      <div className="section-shell">
        <div className="marketing-footer__grid">
          <div className="marketing-footer__identity">
            <BrandMark quiet />
            <p>AI-native products and scientific capabilities for peptide and protein design.</p>
          </div>

          <nav aria-label="Product navigation">
            <p>Product</p>
            {navigation.product.map((link) => (
              <a href={link.href} key={link.href}>
                {link.label}
              </a>
            ))}
            <a href={docsHref}>Docs</a>
            <a href={signInHref}>Sign in</a>
          </nav>

          <nav aria-label="Company navigation">
            <p>Company</p>
            {navigation.company.map((link) => (
              <a href={link.href} key={link.href}>
                {link.label}
              </a>
            ))}
          </nav>

          <address>
            <p>Contact</p>
            <a href={`mailto:${siteConfig.organization.email}`}>{siteConfig.organization.email}</a>
            <a href={siteConfig.organization.phone.href}>{siteConfig.organization.phone.display}</a>
            <span>
              {siteConfig.organization.address.line1}
              <br />
              {siteConfig.organization.address.line2}
              <br />
              {siteConfig.organization.address.cityLine}
            </span>
          </address>
        </div>

        <div className="marketing-footer__legal">
          <p>© {new Date().getFullYear()} XDenovo</p>
          <div>
            <a href="https://beian.miit.gov.cn">沪ICP备2026008379号-1</a>
            <a href="https://beian.mps.gov.cn/#/query/webSearch">沪公网安备31011202022230号</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
