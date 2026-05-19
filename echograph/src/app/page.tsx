import { Suspense } from 'react'
import { NavBar } from '@/components/marketing/nav-bar'
import { Hero } from '@/components/marketing/hero'
import { SocialProofBar } from '@/components/marketing/social-proof-bar'
import { HowItWorks } from '@/components/marketing/how-it-works'
import { FeatureHighlights } from '@/components/marketing/feature-highlights'
import { PrivacyCallout } from '@/components/marketing/privacy-callout'
import { Pricing } from '@/components/marketing/pricing'
import { NewsletterSection } from '@/components/marketing/newsletter-section'
import { Footer } from '@/components/marketing/footer'
import { DeletedBanner } from '@/components/marketing/deleted-banner'
import { InstallBanner } from '@/components/pwa/install-banner'

export default function LandingPage() {
  return (
    <>
      {/* useSearchParams requires Suspense boundary */}
      <Suspense>
        <DeletedBanner />
      </Suspense>
      <NavBar />
      <main>
        <Hero />
        <SocialProofBar />
        <HowItWorks />
        <FeatureHighlights />
        <PrivacyCallout />
        <Pricing />
        <NewsletterSection />
      </main>
      <Footer />
      <InstallBanner />
    </>
  )
}
