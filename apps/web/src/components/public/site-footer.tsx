const OFFICES = ["Shanghai", "Beijing", "Hong Kong", "Seattle"] as const;

export function PublicSiteFooter() {
  return (
    <footer id="contact" className="border-t border-bio-200 bg-lab-100">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <p className="font-display text-lg font-semibold text-ink">
              XDe<span className="text-bio-600">Novo</span>
            </p>
            <p className="mt-3 max-w-sm font-copy text-sm leading-relaxed text-ink-muted">
              AI-native de novo design of peptides and proteins — from computational hypothesis to a
              validated binder.
            </p>
          </div>
          <div>
            <p className="font-copy text-xs font-medium text-ink-muted">R&amp;D presence</p>
            <ul className="mt-3 space-y-1.5 font-copy text-sm text-ink">
              {OFFICES.map((city) => (
                <li key={city}>{city}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-copy text-xs font-medium text-ink-muted">Platform</p>
            <ul className="mt-3 space-y-1.5 font-copy text-sm text-ink">
              <li>
                <a href="/login" className="hover:text-bio-700">
                  Sign in
                </a>
              </li>
              <li className="text-ink-muted">
                Partnership &amp; collaboration inquiries by request
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-4 border-t border-bio-200 pt-6 font-copy text-xs text-ink-muted md:flex-row md:items-center md:justify-between">
          <p>Shanghai XDeNovo Biotechnology Co., Ltd. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="/legal" className="hover:text-bio-700">
              Legal
            </a>
            <a href="/privacy" className="hover:text-bio-700">
              Privacy
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
