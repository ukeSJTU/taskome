import { AccessSection } from "@/app/_components/access-section";
import { ApproachSection } from "@/app/_components/approach-section";
import { CapabilitiesSection } from "@/app/_components/capabilities-section";
import { CompanySection } from "@/app/_components/company-section";
import { FinalPrompt } from "@/app/_components/final-prompt";
import { Hero } from "@/app/_components/hero";
import { MarketingHeader } from "@/app/_components/marketing-header";
import { MarketingFooter } from "@/app/_components/marketing-footer";
import { StructuredData } from "@/app/_components/structured-data";
import { TaskomeStory } from "@/app/_components/taskome-story";
import { siteConfig } from "@/lib/site-config";

const primaryNavigation = [
  { href: "#taskome", label: "Taskome" },
  { href: "#capabilities", label: "Capabilities" },
  { href: "#company", label: "Company" },
] as const;

export default function Home() {
  return (
    <div className="marketing-page">
      <StructuredData />
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <MarketingHeader
        docsHref={siteConfig.links.docs}
        navigation={primaryNavigation}
        signInHref={siteConfig.links.signIn}
      />
      <main id="main-content">
        <Hero signInHref={siteConfig.links.signIn} />
        <ApproachSection />
        <TaskomeStory />
        <AccessSection />
        <CapabilitiesSection />
        <CompanySection />
        <FinalPrompt signInHref={siteConfig.links.signIn} />
      </main>
      <MarketingFooter docsHref={siteConfig.links.docs} signInHref={siteConfig.links.signIn} />
    </div>
  );
}
