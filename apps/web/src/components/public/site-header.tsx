"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { PublicThemeToggle } from "./theme-toggle";

const NAV_LINKS = [
  { href: "#mission", label: "Mission" },
  { href: "#platform", label: "Platform" },
  { href: "#products", label: "Products" },
  { href: "#team", label: "Team" },
  { href: "#contact", label: "Contact" },
] as const;

export function PublicSiteHeader() {
  const [open, setOpen] = useState(false);

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
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="font-copy text-sm text-ink-muted transition-colors hover:text-bio-700"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-5 md:flex">
          <Link
            href="/login"
            className="font-copy text-sm font-medium text-ink-muted transition-colors hover:text-bio-700"
          >
            Platform sign in
          </Link>
          <PublicThemeToggle />
        </div>
        <div className="flex items-center gap-3 md:hidden">
          <PublicThemeToggle />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="public-mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            className="text-ink"
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      <nav
        id="public-mobile-nav"
        className={`grid overflow-hidden border-t border-bio-200/70 bg-lab transition-[grid-template-rows] duration-300 ease-out md:hidden ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr] border-t-0"
        }`}
      >
        <div className="flex min-h-0 flex-col px-6 py-2">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="font-copy border-b border-bio-100 py-3 text-sm text-ink-muted transition-colors hover:text-bio-700"
            >
              {link.label}
            </a>
          ))}
          <Link
            href="/login"
            onClick={() => setOpen(false)}
            className="font-copy py-3 text-sm font-medium text-ink-muted transition-colors hover:text-bio-700"
          >
            Platform sign in
          </Link>
        </div>
      </nav>
    </header>
  );
}
