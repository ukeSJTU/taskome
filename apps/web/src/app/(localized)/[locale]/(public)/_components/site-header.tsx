"use client";

import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { LanguageSwitcher } from "@/app/(localized)/[locale]/_components/language-switcher";
import { Link, usePathname } from "@/i18n/navigation";
import { PublicThemeToggle } from "./theme-toggle";

export function PublicSiteHeader() {
  const t = useTranslations("Navigation");
  const common = useTranslations("Common");
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const navLinks = [
    { href: "/technology" as const, label: t("technology") },
    { href: "/products" as const, label: t("products") },
    { href: "/platform-cases" as const, label: t("platformCases") },
    { href: "/about" as const, label: t("about") },
    { href: "/contact" as const, label: t("contact") },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-bio-200/70 bg-lab/90 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="font-display text-lg font-semibold tracking-tight text-ink"
          onClick={() => setOpen(false)}
        >
          XDe<span className="text-bio-600">Novo</span>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? "page" : undefined}
              className={`font-copy text-sm transition-colors hover:text-bio-700 ${
                pathname === link.href ? "font-medium text-bio-700" : "text-ink-muted"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-5 md:flex">
          <Link
            href="/login"
            className="font-copy text-sm font-medium text-ink-muted transition-colors hover:text-bio-700"
          >
            {t("platformSignIn")}
          </Link>
          <LanguageSwitcher className="font-copy text-sm font-medium text-ink-muted transition-colors hover:text-bio-700" />
          <PublicThemeToggle />
        </div>
        <div className="flex items-center gap-3 md:hidden">
          <PublicThemeToggle />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="public-mobile-nav"
            aria-label={open ? common("closeMenu") : common("openMenu")}
            className="text-ink"
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      <nav
        id="public-mobile-nav"
        aria-hidden={!open}
        inert={!open || undefined}
        className={`grid overflow-hidden border-t border-bio-200/70 bg-lab transition-[grid-template-rows] duration-300 ease-out md:hidden ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr] border-t-0"
        }`}
      >
        <div className="flex min-h-0 flex-col px-6 py-2">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              tabIndex={open ? undefined : -1}
              aria-current={pathname === link.href ? "page" : undefined}
              className={`font-copy border-b border-bio-100 py-3 text-sm transition-colors hover:text-bio-700 ${
                pathname === link.href ? "font-medium text-bio-700" : "text-ink-muted"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/login"
            onClick={() => setOpen(false)}
            tabIndex={open ? undefined : -1}
            className="font-copy py-3 text-sm font-medium text-ink-muted transition-colors hover:text-bio-700"
          >
            {t("platformSignIn")}
          </Link>
          <LanguageSwitcher
            onClick={() => setOpen(false)}
            tabIndex={open ? undefined : -1}
            className="font-copy py-3 text-sm font-medium text-ink-muted transition-colors hover:text-bio-700"
          />
        </div>
      </nav>
    </header>
  );
}
