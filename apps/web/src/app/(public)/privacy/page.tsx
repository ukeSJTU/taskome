import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — XDeNovo",
  description: "How XDeNovo collects, uses, and protects your personal information.",
};

const SECTIONS = [
  {
    title: "1. Definitions and scope",
    body: "Personal information means any information relating to an identified or identifiable natural person, recorded electronically or otherwise. Sensitive personal information — data that could harm your dignity or safety if leaked or misused — is separately flagged before we collect it. This policy covers the services we provide through the XDeNovo website and related channels; it does not apply to linked third-party sites or to products with their own published information-processing rules.",
  },
  {
    title: "2. What we collect, and why",
    body: "Browsing the site: we use analytics tooling to log access time, region, device, browser, and on-site behavior. Contacting us: when you reach out about our products, services, or a partnership, we collect what's needed to respond — your name, company, role, contact details, and the substance of your inquiry. Business partnerships: we collect the contact and mailing details needed to establish and run a partnership. Recruitment: applications submitted through linked third-party recruitment platforms are used to evaluate candidates and manage hiring. Where information is optional, declining it only limits the corresponding service, not your ability to browse the site.",
  },
  {
    title: "3. How we use and store it",
    body: "We use collected information only to provide the services described in this policy, to meet legal or regulatory obligations, or with your separate consent for anything else. Information collected in China is stored under Chinese law; where a purpose in this policy requires transferring information outside China, we do so under the safeguards described in Section 5. We retain personal information only as long as its collection purpose or applicable law requires, then delete or anonymize it.",
  },
  {
    title: "4. Cookies and similar technologies",
    body: "We use cookies and comparable technologies — including third-party analytics — to keep the site running smoothly, remember preferences, and understand aggregate usage. You can limit or clear cookies through your browser's privacy settings at any time.",
  },
  {
    title: "5. Sharing, transfer, and disclosure",
    body: "We do not share, transfer, or publicly disclose your personal information except with your explicit consent, when required by law or legal process, or when a service provider processes it on our behalf under a confidentiality agreement that binds them to this policy's standards. In a merger, acquisition, or similar transaction, any successor holding your data remains bound by this policy or must seek your renewed consent.",
  },
  {
    title: "6. Cross-border transfer",
    body: "As a company operating across multiple locations, some processing may involve colleagues or service providers outside China. Where that happens, we require recipients to protect your information to a standard at least equivalent to Chinese law, and only after meeting applicable regulatory requirements for the transfer.",
  },
  {
    title: "7. How we protect your information",
    body: "We apply encryption in transit, access controls, and other technical and organizational safeguards appropriate to current practice, and maintain an incident-response plan for security events. No method of transmission or storage is completely secure, and we cannot guarantee absolute protection.",
  },
  {
    title: "8. Your rights",
    body: "You may request access to, correction of, or deletion of your personal information, withdraw previously given consent, or ask us to explain any part of this policy, by emailing HengnanZH@foxmail.com. We verify your identity before acting on a request and respond within 15 working days, or the timeframe required by law for more complex requests.",
  },
  {
    title: "9. Children's information",
    body: "Our services are intended for adults with relevant professional backgrounds. We do not knowingly collect personal information from minors without a guardian's consent, and will delete such information promptly if notified by a legal guardian.",
  },
  {
    title: "10. Updates to this policy",
    body: "We may update this policy as our services or applicable law change. Material changes are published on this page; we will not reduce your rights under this policy without your explicit consent.",
  },
] as const;

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-24">
      <h1 className="font-display text-3xl font-semibold text-ink md:text-4xl">Privacy policy</h1>
      <p className="font-copy mt-6 leading-relaxed text-ink-muted">
        Shanghai XDeNovo Biotechnology Co., Ltd. (&ldquo;XDeNovo,&rdquo; &ldquo;we&rdquo;) operates
        the XDeNovo website. We know personal information matters to you, and this policy explains
        how we collect, use, disclose, protect, and store it when you visit the site or otherwise
        interact with us. Please read it before providing us with any personal information. Our
        services are intended for users 18 or older; a minor should only use them with a guardian's
        consent and guidance.
      </p>

      <div className="mt-12 divide-y divide-bio-200 border-y border-bio-200">
        {SECTIONS.map((section) => (
          <section key={section.title} className="py-7">
            <h2 className="font-display text-lg font-medium text-ink">{section.title}</h2>
            <p className="font-copy mt-2 leading-relaxed text-ink-muted">{section.body}</p>
          </section>
        ))}
      </div>

      <section className="mt-12">
        <h2 className="font-display text-lg font-medium text-ink">11. Contact us</h2>
        <p className="font-copy mt-2 leading-relaxed text-ink-muted">
          Shanghai XDeNovo Biotechnology Co., Ltd.
          <br />
          Service email:{" "}
          <a href="mailto:HengnanZH@foxmail.com" className="hover:text-bio-700">
            HengnanZH@foxmail.com
          </a>
          <br />
          Address: Room 402, Building 5, 396 Lvzhou Ring Road, Minhang District, Shanghai, China
        </p>
      </section>
    </main>
  );
}
