import { CtaBanner } from "@/components/landing/cta-banner";
import { HeroSection } from "@/components/landing/hero-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { LanguageSection } from "@/components/landing/language-section";
import { LowBandwidthSection } from "@/components/landing/low-bandwidth-section";
import { ServicesSection } from "@/components/landing/services-section";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { SkipLink } from "@/components/landing/skip-link";

export default function HomePage() {
  return (
    <>
      <SkipLink />
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="outline-none">
        <HeroSection />
        <LanguageSection />
        <ServicesSection />
        <HowItWorksSection />
        <LowBandwidthSection />
        <CtaBanner />
      </main>
      <SiteFooter />
    </>
  );
}
