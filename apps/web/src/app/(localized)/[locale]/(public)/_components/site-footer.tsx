import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

const OFFICES = ["Shanghai", "Beijing", "Hong Kong", "Seattle"] as const;

export function PublicSiteFooter() {
  const t = useTranslations("Navigation");

  return (
    <footer id="contact" className="border-t border-bio-200 bg-lab-100">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <p className="font-display text-lg font-semibold text-ink">
              XDe<span className="text-bio-600">Novo</span>
            </p>
            <p className="mt-3 max-w-sm font-copy text-sm leading-relaxed text-ink-muted">
              {t("footerDescription")}
            </p>
          </div>
          <div>
            <p className="font-copy text-xs font-medium text-ink-muted">{t("researchPresence")}</p>
            <ul className="mt-3 space-y-1.5 font-copy text-sm text-ink">
              {OFFICES.map((city) => (
                <li key={city}>{city}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-copy text-xs font-medium text-ink-muted">{t("platform")}</p>
            <ul className="mt-3 space-y-1.5 font-copy text-sm text-ink">
              <li>
                <Link href="/login" className="hover:text-bio-700">
                  {t("signIn")}
                </Link>
              </li>
              <li className="text-ink-muted">{t("partnership")}</li>
            </ul>
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-4 border-t border-bio-200 pt-6 font-copy text-xs text-ink-muted md:flex-row md:items-center md:justify-between">
          <p>{t("copyright")}</p>
          <div className="flex gap-6">
            <Link href="/legal" className="hover:text-bio-700">
              {t("legal")}
            </Link>
            <Link href="/privacy" className="hover:text-bio-700">
              {t("privacy")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
