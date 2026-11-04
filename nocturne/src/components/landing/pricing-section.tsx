'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Segmented } from '@/components/surgical/segmented'

// Beta mode: checkout is not yet open. All CTAs scroll to the beta request form.
const IS_BETA = process.env.NEXT_PUBLIC_BETA_MODE === 'true'

type Billing = 'monthly' | 'yearly'
type CheckoutTier = 'midnight' | 'eclipse'

const PLAN_SRC = [
  {
    name: 'Dusk',
    monthly: 0,
    tagline: 'The full core product.',
    badge: '',
    hi: false,
    coming: false,
    cta: 'Start for free',
    primary: false,
    tier: null as CheckoutTier | null,
    features: [
      'PDF viewer + slide extraction',
      'Whisper browser transcription',
      'Synthetic Study Guide',
      'Red Zone scoring',
      'Slide density heatmap',
      'Anki .apkg import + export',
      '500 MB encrypted storage',
      '3 sessions per month',
    ],
  },
  {
    name: 'Midnight',
    monthly: 8,
    tagline: 'Sharper transcription. More storage.',
    badge: 'POPULAR',
    hi: true,
    coming: false,
    cta: 'Get Midnight',
    primary: true,
    tier: 'midnight' as CheckoutTier | null,
    features: [
      'Everything in Dusk',
      'Server-side ASR + diarization',
      'Hotword injection from guide',
      'YouTube Red Zone search',
      'Cross-session convergence',
      'Exam Urgency Mode',
      '5 GB encrypted storage',
      'Unlimited sessions',
    ],
  },
  {
    name: 'Eclipse',
    monthly: 20,
    tagline: 'Everything, with AI explanations.',
    badge: 'SOON',
    hi: false,
    coming: true,
    cta: 'Join the waitlist',
    primary: false,
    tier: null as CheckoutTier | null,
    features: [
      'Everything in Midnight',
      'AI summarization (opt-in)',
      'Practice quiz mode',
      'Cross-session deck merging',
      'Markdown notes export',
      '20 GB encrypted storage',
      'Priority processing',
    ],
  },
]

export function PricingSection() {
  const [billing, setBilling] = useState<Billing>('yearly')
  const [loadingTier, setLoadingTier] = useState<CheckoutTier | null>(null)
  const router = useRouter()

  async function handleCheckout(tier: CheckoutTier) {
    setLoadingTier(tier)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      })
      if (res.status === 401) {
        // Not logged in — go to login, then return here for checkout
        router.push(`/login?next=/checkout?tier=${tier}`)
        return
      }
      if (!res.ok) {
        console.error('[checkout] unexpected error', res.status)
        return
      }
      const { url } = (await res.json()) as { url: string }
      window.location.href = url
    } finally {
      setLoadingTier(null)
    }
  }
  const yearly = billing === 'yearly'

  const ctaBase: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 500,
    transition: 'background .2s, border-color .2s',
    textDecoration: 'none',
    cursor: 'pointer',
  }

  return (
    <section
      id="pricing"
      style={{
        position: 'relative',
        scrollMarginTop: 64,
        padding: 'clamp(88px,10vw,140px) clamp(20px,4vw,40px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 48 }}>
        <div data-split style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 40, alignItems: 'end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.16em', color: '#FF3B30' }}>PRICING</span>
            <h2
              style={{
                margin: 0,
                fontFamily: 'var(--font-display)',
                fontStretch: '82%',
                fontWeight: 600,
                fontSize: 'clamp(34px,4.2vw,56px)',
                lineHeight: 1,
                letterSpacing: '-0.03em',
              }}
            >
              The free tier is the full product.
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'flex-start' }}>
            <p style={{ margin: 0, maxWidth: 460, fontSize: 16, color: '#9A9A9F', textWrap: 'pretty' }}>
              The complete core pipeline is free. Paid tiers add sharper transcription and more
              storage, never access to the basics.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <Segmented
                value={billing}
                onChange={setBilling}
                options={[
                  { value: 'monthly', label: 'MONTHLY' },
                  { value: 'yearly', label: 'YEARLY · SAVE 25%' },
                ]}
              />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.08em', color: '#76767B' }}>
                {yearly ? 'THREE MONTHS FREE VS. MONTHLY' : 'SWITCH TO YEARLY TO SAVE 25%'}
              </span>
            </div>
          </div>
        </div>

        <div data-plans style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', border: '1px solid rgba(255,255,255,0.08)', background: '#0C0C0D' }}>
          {PLAN_SRC.map((p, i) => {
            const free = p.monthly === 0
            const perMo = yearly ? p.monthly * 0.75 : p.monthly
            const annual = perMo * 12
            const showStrike = yearly && !free

            return (
              <div
                key={p.name}
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 18,
                  padding: '32px 28px',
                  borderLeft: i ? '1px solid rgba(255,255,255,0.08)' : 'none',
                  background: p.hi ? 'rgba(255,59,48,0.04)' : 'transparent',
                }}
              >
                <span style={{ position: 'absolute', top: -1, left: -1, right: -1, height: 2, background: p.hi ? '#FF3B30' : 'transparent' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 22 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, letterSpacing: '0.18em', color: '#EDEDED' }}>
                    {p.name.toUpperCase()}
                  </span>
                  {p.badge && (
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        letterSpacing: '0.16em',
                        padding: '3px 7px',
                        color: p.hi ? '#FF3B30' : '#9A9A9F',
                        border: '1px solid ' + (p.hi ? 'rgba(255,59,48,0.45)' : 'rgba(255,255,255,0.14)'),
                      }}
                    >
                      {p.badge}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  {showStrike && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: '#5E5E62', textDecoration: 'line-through' }}>
                      ${p.monthly}
                    </span>
                  )}
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 48, lineHeight: 1, letterSpacing: '-0.03em', color: '#EDEDED' }}>
                    {free ? '$0' : `$${perMo}`}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#76767B' }}>{free ? 'forever' : '/ mo'}</span>
                </div>

                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em', color: '#76767B', marginTop: -8 }}>
                  {free ? 'NO CARD REQUIRED' : yearly ? `$${annual} BILLED YEARLY` : `$${p.monthly * 12} / YR BILLED MONTHLY`}
                </span>

                <p style={{ margin: 0, fontSize: 14, color: '#9A9A9F' }}>{p.tagline}</p>

                {IS_BETA ? (
                  <a
                    href="#beta-request"
                    className="pricing-cta"
                    onClick={(e) => {
                      e.preventDefault()
                      document.getElementById('beta-request')?.scrollIntoView({ behavior: 'smooth' })
                    }}
                    style={{
                      ...ctaBase,
                      background: p.primary ? '#FF3B30' : 'transparent',
                      color: p.primary ? '#0A0A0A' : '#EDEDED',
                      border: p.primary ? 'none' : '1px solid rgba(255,255,255,0.16)',
                    }}
                  >
                    Request beta access
                  </a>
                ) : p.tier ? (
                  <button
                    type="button"
                    className="pricing-cta"
                    onClick={() => handleCheckout(p.tier!)}
                    disabled={loadingTier === p.tier}
                    style={{
                      ...ctaBase,
                      width: '100%',
                      background: p.primary ? '#FF3B30' : 'transparent',
                      color: p.primary ? '#0A0A0A' : '#EDEDED',
                      border: p.primary ? 'none' : '1px solid rgba(255,255,255,0.16)',
                      cursor: loadingTier === p.tier ? 'not-allowed' : 'pointer',
                      opacity: loadingTier === p.tier ? 0.7 : 1,
                    }}
                  >
                    {loadingTier === p.tier ? 'Redirecting…' : p.cta}
                  </button>
                ) : p.coming ? (
                  <Link href="#newsletter" className="pricing-cta" style={{ ...ctaBase, width: '100%', background: 'transparent', color: '#EDEDED', border: '1px solid rgba(255,255,255,0.16)' }}>
                    {p.cta}
                  </Link>
                ) : (
                  <Link href="/setup" className="pricing-cta" style={{ ...ctaBase, width: '100%', background: 'transparent', color: '#EDEDED', border: '1px solid rgba(255,255,255,0.16)' }}>
                    {p.cta}
                  </Link>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 4 }}>
                  {p.features.map((f) => (
                    <div
                      key={f}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '18px 1fr',
                        gap: 8,
                        padding: '10px 0',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        fontSize: 13.5,
                        color: '#CFCFD2',
                      }}
                    >
                      <span style={{ fontFamily: 'var(--font-mono)', color: p.hi ? '#FF3B30' : '#76767B' }}>+</span>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <style>{`
        .pricing-cta { height: 42px; }
        @media (max-width: 767px) {
          .pricing-cta { height: 44px; }
        }
      `}</style>
    </section>
  )
}
