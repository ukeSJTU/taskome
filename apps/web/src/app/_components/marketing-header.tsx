"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@taskome/ui/components/sheet";

import { BrandMark } from "@/app/_components/brand-mark";

type MarketingHeaderProps = {
  docsHref: string;
  navigation: ReadonlyArray<{ href: string; label: string }>;
  signInHref: string;
};

export function MarketingHeader({ docsHref, navigation, signInHref }: MarketingHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className="marketing-header">
        <div className="marketing-header__inner">
          <Link className="brand-link" href="/" aria-label="XDenovo home">
            <BrandMark />
          </Link>

          <nav className="desktop-navigation" aria-label="Primary navigation">
            {navigation.map((item) => (
              <a className="navigation-link" href={item.href} key={item.href}>
                {item.label}
              </a>
            ))}
            <a className="navigation-link" href={docsHref}>
              Docs
            </a>
          </nav>

          <div className="marketing-header__actions">
            <a className="signal-action signal-action--header" href={signInHref}>
              Sign in
            </a>

            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger className="menu-trigger" aria-label="Open navigation">
                <span aria-hidden="true" />
                <span aria-hidden="true" />
              </SheetTrigger>
              <SheetContent className="mobile-navigation" side="right">
                <div className="mobile-navigation__heading">
                  <SheetTitle>Navigate XDenovo</SheetTitle>
                  <SheetDescription>Company, product, and technical destinations.</SheetDescription>
                </div>
                <nav aria-label="Mobile navigation">
                  {navigation.map((item) => (
                    <a
                      className="mobile-navigation__link"
                      href={item.href}
                      key={item.href}
                      onClick={() => setMenuOpen(false)}
                    >
                      {item.label}
                    </a>
                  ))}
                  <a
                    className="mobile-navigation__link"
                    href={docsHref}
                    onClick={() => setMenuOpen(false)}
                  >
                    Docs
                  </a>
                </nav>
                <div className="mobile-navigation__footer">
                  <a className="signal-action" href={signInHref}>
                    Sign in to Taskome
                  </a>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      <noscript>
        <nav className="no-script-navigation" aria-label="Primary navigation without JavaScript">
          {navigation.map((item) => (
            <a href={item.href} key={item.href}>
              {item.label}
            </a>
          ))}
          <a href={docsHref}>Docs</a>
        </nav>
      </noscript>
    </>
  );
}
