import { StructuredData } from '@/components/landing/structured-data'
import { SiteHeader } from '@/components/landing/site-header'
import { HeroSection } from '@/components/landing/hero-section'
import { EngineSection } from '@/components/landing/engine-section'
import { DemoSection } from '@/components/landing/demo-section'
import { WorkflowsSection } from '@/components/landing/workflows-section'
import { ArchitectureSection } from '@/components/landing/architecture-section'
import { PricingSection } from '@/components/landing/pricing-section'
import { SpecBar } from '@/components/landing/spec-bar'
import { FooterCta } from '@/components/landing/footer-cta'
import { FaqSection } from '@/components/landing/faq-section'
import { NewsletterSection } from '@/components/landing/newsletter-section'
import { BetaRequestSection } from '@/components/landing/beta-request-section'
import { SiteFooter } from '@/components/landing/site-footer'

// Server component — reads env directly. Both flags must be kept in sync.
const betaMode = process.env.BETA_MODE === 'true'

// Section order follows the "Nocturne Landing v2" reference (design_handoff_nocturne) —
// THEME_SURGICAL.md §9: Nav → Hero → Engine → Demo → Path A → Path B/Privacy/Systems-log →
// Pricing → Spec bar → Footer CTA. FAQ/Newsletter/BetaRequest have no reference counterpart but
// carry real content (lead capture, FAQ) that predates this redesign, so they're appended after
// the reference's own sections and before the footer, restyled to the same system.
export default function LandingPage() {
  return (
    <div style={{ position: 'relative', background: '#0A0A0A' }}>
      <StructuredData />
      <SiteHeader />
      <span id="top" />
      <HeroSection />
      <EngineSection />
      <DemoSection />
      <WorkflowsSection />
      <ArchitectureSection />
      <PricingSection />
      <SpecBar />
      <FooterCta />

      {/* Beta request form — shown only in beta mode */}
      {betaMode && <BetaRequestSection />}

      <FaqSection />

      {/* Newsletter — hidden during beta (not deleted; returns when BETA_MODE=false) */}
      {!betaMode && <NewsletterSection />}

      <SiteFooter />
    </div>
  )
}
