import { useTranslations } from "next-intl";

export function ContactInfoSection() {
  const t = useTranslations("Contact");
  const contactRows = [
    { label: t("email"), value: "contact@xdenovoai.com", href: "mailto:contact@xdenovoai.com" },
    { label: t("phone"), value: "+86 183-5485-8296", href: "tel:+8618354858296" },
    { label: t("headquarters"), value: t("headquartersValue"), href: undefined },
    { label: t("researchPresence"), value: t("researchPresenceValue"), href: undefined },
  ];
  const hours = [
    { day: t("weekdays"), time: "9:00 – 18:00" },
    { day: t("saturday"), time: t("appointment") },
    { day: t("sunday"), time: t("closed") },
  ];

  return (
    <section className="mx-auto max-w-3xl px-6 pb-24">
      <a
        href="mailto:contact@xdenovoai.com"
        className="font-copy inline-block rounded-full bg-signal-700 px-6 py-3 text-sm font-medium text-paper transition-colors hover:bg-signal-800"
      >
        {t("emailUs")}
      </a>

      <div className="mt-12 divide-y divide-bio-200 border-y border-bio-200">
        {contactRows.map((row) =>
          row.href ? (
            <a
              key={row.label}
              href={row.href}
              className="grid gap-1 py-6 transition-colors hover:text-bio-700 md:grid-cols-[1fr_2fr] md:items-baseline md:gap-6"
            >
              <p className="font-copy text-xs font-medium text-ink-muted">{row.label}</p>
              <p className="font-copy text-sm text-ink">{row.value}</p>
            </a>
          ) : (
            <div
              key={row.label}
              className="grid gap-1 py-6 md:grid-cols-[1fr_2fr] md:items-baseline md:gap-6"
            >
              <p className="font-copy text-xs font-medium text-ink-muted">{row.label}</p>
              <p className="font-copy text-sm text-ink">{row.value}</p>
            </div>
          ),
        )}
      </div>

      <h2 className="font-display mt-16 text-xl font-medium text-ink">{t("businessHours")}</h2>
      <p className="font-copy mt-1 text-xs text-ink-muted">{t("timezone")}</p>
      <div className="mt-4 divide-y divide-bio-200 border-y border-bio-200">
        {hours.map((row) => (
          <div key={row.day} className="flex items-center justify-between py-4">
            <p className="font-copy text-sm text-ink-muted">{row.day}</p>
            <p className="font-copy text-sm font-medium text-ink">{row.time}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
