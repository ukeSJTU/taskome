import { siteConfig } from "@/lib/site-config";

export function StructuredData() {
  const organizationId = new URL("/#organization", siteConfig.origins.web).toString();
  const taskomeId = new URL("/#taskome", siteConfig.origins.web).toString();
  const logoUrl = new URL("/brand/xdenovo-mark.png", siteConfig.origins.web).toString();

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organizationId,
        name: "XDenovo",
        url: siteConfig.origins.web.toString(),
        logo: {
          "@type": "ImageObject",
          url: logoUrl,
          width: 512,
          height: 512,
        },
        email: siteConfig.organization.email,
        telephone: siteConfig.organization.phone.structuredValue,
        address: {
          "@type": "PostalAddress",
          streetAddress: siteConfig.organization.address.streetAddress,
          addressLocality: siteConfig.organization.address.locality,
          addressRegion: siteConfig.organization.address.region,
          addressCountry: siteConfig.organization.address.country,
        },
      },
      {
        "@type": "SoftwareApplication",
        "@id": taskomeId,
        name: "Taskome",
        url: siteConfig.origins.console.toString(),
        applicationCategory: "ScienceApplication",
        operatingSystem: "Web",
        description:
          "A platform for running, managing, and reproducing protein-design compute through curated Tools and durable provenance.",
        provider: {
          "@id": organizationId,
        },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replaceAll("<", "\\u003c") }}
    />
  );
}
