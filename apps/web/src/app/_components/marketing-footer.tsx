import { BrandMark } from "@/app/_components/brand-mark";

type MarketingFooterProps = {
  docsHref: string;
  signInHref: string;
};

const companyLinks = [
  { href: "#taskome", label: "Taskome" },
  { href: "#capabilities", label: "Capabilities" },
  { href: "#company", label: "Company" },
] as const;

export function MarketingFooter({ docsHref, signInHref }: MarketingFooterProps) {
  return (
    <footer className="marketing-footer">
      <div className="section-shell">
        <div className="marketing-footer__grid">
          <div className="marketing-footer__identity">
            <BrandMark quiet />
            <p>AI-native products and scientific capabilities for peptide and protein design.</p>
          </div>

          <nav aria-label="Footer navigation">
            <p>Navigate</p>
            {companyLinks.map((link) => (
              <a href={link.href} key={link.href}>
                {link.label}
              </a>
            ))}
            <a href={docsHref}>Docs</a>
            <a href={signInHref}>Sign in</a>
          </nav>

          <address>
            <p>Contact</p>
            <a href="mailto:contact@xdenovoai.com">contact@xdenovoai.com</a>
            <a href="tel:+8618354858296">+86 183 5485 8296</a>
            <span>
              Room 402, Building 5
              <br />
              396 Lvzhou Ring Road
              <br />
              Minhang, Shanghai, China
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
