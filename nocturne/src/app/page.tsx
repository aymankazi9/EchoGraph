import Link from 'next/link'
import { LandingNav } from '@/components/landing/landing-nav'
import { LandingHero } from '@/components/landing/landing-hero'
import { FieldsMarquee } from '@/components/landing/fields-marquee'
import { ProblemSection } from '@/components/landing/problem-section'
import { HowItWorksSection } from '@/components/landing/how-it-works-section'
import { DemoSection } from '@/components/landing/demo-section'
import { FeaturesSection } from '@/components/landing/features-section'
import { CompareSection } from '@/components/landing/compare-section'
import { PrivacySection } from '@/components/landing/privacy-section'
import { SocialProofSection } from '@/components/landing/social-proof-section'
import { PricingSection } from '@/components/landing/pricing-section'
import { FaqSection } from '@/components/landing/faq-section'
import { NewsletterSection } from '@/components/landing/newsletter-section'
import { LandingFooter } from '@/components/landing/landing-footer'
import { RevealSetup } from '@/components/landing/reveal-setup'

export default function LandingPage() {
  return (
    <div style={{ position: 'relative', background: '#09090F' }}>
      <RevealSetup />
      <LandingNav />
      <span id="top" />
      <LandingHero />
      <FieldsMarquee />
      <ProblemSection />
      <HowItWorksSection />
      <DemoSection />
      <FeaturesSection />
      <CompareSection />
      <PrivacySection />
      <SocialProofSection />
      <PricingSection />
      <FaqSection />

      {/* CTA section — "Walk into the exam" */}
      <section
        style={{
          position: 'relative',
          padding: 'clamp(80px,10vw,140px) 24px',
          borderTop: '1px solid #191827',
          overflow: 'hidden',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%,-50%)',
            width: 820,
            maxWidth: '120vw',
            height: 420,
            background: 'radial-gradient(ellipse at center, rgba(99,102,241,0.12) 0%, rgba(244,63,94,0.05) 45%, transparent 72%)',
            filter: 'blur(60px)',
            pointerEvents: 'none',
          }}
        />
        <div data-reveal="" style={{ position: 'relative', maxWidth: 680, margin: '0 auto' }}>
          <h2
            style={{
              fontSize: 'clamp(32px,5vw,56px)',
              fontWeight: 600,
              letterSpacing: '-0.025em',
              lineHeight: 1.08,
              margin: 0,
              color: '#E2E8F0',
            }}
          >
            Walk into the exam<br />knowing what&apos;s on it.
          </h2>
          <p
            style={{
              fontSize: 17,
              color: '#94A3B8',
              margin: '22px auto 0',
              maxWidth: 480,
            }}
          >
            No credit card, no trial limits — just the core pipeline, free forever, running entirely in your browser.
          </p>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              justifyContent: 'center',
              marginTop: 36,
            }}
          >
            <Link
              href="/setup"
              data-btn=""
              data-shine=""
              style={{
                height: 48,
                padding: '0 28px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 9,
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 500,
                background: '#6366F1',
                color: '#09090F',
                boxShadow: '0 10px 32px rgba(99,102,241,0.4)',
                textDecoration: 'none',
              }}
            >
              Start for free <span data-arrow="" style={{ color: '#09090F' }}>→</span>
            </Link>
            <a
              href="#pricing"
              data-btn=""
              style={{
                height: 48,
                padding: '0 24px',
                display: 'inline-flex',
                alignItems: 'center',
                borderRadius: 8,
                fontSize: 15,
                color: '#E2E8F0',
                border: '1px solid #2D2B45',
                textDecoration: 'none',
              }}
            >
              Compare plans
            </a>
          </div>
        </div>
      </section>

      <NewsletterSection />
      <LandingFooter />
    </div>
  )
}
