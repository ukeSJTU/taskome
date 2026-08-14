import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Legal Statement — XDeNovo",
  description: "Terms governing use of the XDeNovo website.",
};

const SECTIONS = [
  {
    title: "1. Usage",
    body: "By using this website you agree to comply with applicable law and not to use it to create, copy, or disseminate unlawful information, infringe on others' rights, or disrupt public order. XDeNovo may take legal and equitable remedies against violations of this statement.",
  },
  {
    title: "2. Copyright and trademarks",
    body: "Unless otherwise stated, XDeNovo owns or holds a license to all text, images, code, designs, and data on this site, protected under the copyright laws of China and other jurisdictions. No individual or organization may copy, modify, distribute, or commercially use any part of this content without XDeNovo's prior written permission. All trademarks displayed on the site are the registered or licensed marks of XDeNovo. If you believe content on this site infringes your rights, contact us and we will review and respond.",
  },
  {
    title: "3. Disclaimer",
    body: "Content on this site is provided for reference only. XDeNovo does not guarantee its accuracy, completeness, or timeliness, and is not liable for decisions made on the basis of it.",
  },
  {
    title: "4. Products and services",
    body: "Information on this site is international in scope; not every product or service described is available in every country or region. Contact XDeNovo to confirm availability.",
  },
  {
    title: "5. Third-party links",
    body: "This site may link to third-party websites for convenience only. A link does not imply XDeNovo's endorsement, and XDeNovo does not guarantee the accuracy or reliability of linked content.",
  },
  {
    title: "6. Privacy",
    body: "Most services on this site require no registration. Where a service does require personal data, we collect it only with your prior consent and handle it under our Privacy Policy.",
  },
  {
    title: "7. Governing law",
    body: "Access to and use of this website, and any dispute arising from it, is governed by the laws of the People's Republic of China.",
  },
] as const;

export default function LegalPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-24">
      <h1 className="font-display text-3xl font-semibold text-ink md:text-4xl">Legal statement</h1>
      <p className="font-copy mt-6 leading-relaxed text-ink-muted">
        Welcome to the website of Shanghai XDeNovo Biotechnology Co., Ltd. (&ldquo;XDeNovo&rdquo;).
        By continuing to access, browse, or use this website after reading this statement, you agree
        to be bound by it. If you do not agree, please stop using this website.
      </p>
      <p className="font-copy mt-4 leading-relaxed text-ink-muted">
        XDeNovo may correct, modify, or update this statement at any time without further notice.
      </p>

      <div className="mt-12 divide-y divide-bio-200 border-y border-bio-200">
        {SECTIONS.map((section) => (
          <section key={section.title} className="py-7">
            <h2 className="font-display text-lg font-medium text-ink">{section.title}</h2>
            <p className="font-copy mt-2 leading-relaxed text-ink-muted">{section.body}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
