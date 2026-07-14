'use client'

import { useState } from 'react'
import Link from 'next/link'

type Billing = 'monthly' | 'yearly'

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
    href: '/login' as string,
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
    badge: 'Popular',
    hi: true,
    coming: false,
    cta: 'Get Midnight',
    primary: true,
    href: '/login' as string,
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
    badge: '',
    hi: false,
    coming: true,
    cta: 'Join the waitlist',
    primary: false,
    href: '#newsletter' as string,
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
  const yearly = billing === 'yearly'

  const segBase: React.CSSProperties = {
    height: 34,
    padding: '0 18px',
    borderRadius: 9999,
    border: 'none',
    cursor: 'pointer',
    fontSize: 13.5,
    fontWeight: 500,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    transition: 'background .25s, color .25s',
  }

  return (
    <section
      id="pricing"
      style={{
        scrollMarginTop: 80,
        padding: 'clamp(72px,9vw,120px) 24px',
        borderTop: '1px solid #191827',
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Header */}
        <div data-reveal="" style={{ textAlign: 'center', marginBottom: 52 }}>
          <p
            style={{
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: '#5B6478',
              margin: '0 0 14px',
            }}
          >
            Pricing
          </p>
          <h2
            style={{
              fontSize: 'clamp(28px,4vw,40px)',
              fontWeight: 600,
              letterSpacing: '-0.02em',
              margin: 0,
              color: '#E2E8F0',
            }}
          >
            The free tier is the full product.
          </h2>
          <p
            style={{
              fontSize: 16,
              color: '#94A3B8',
              maxWidth: 460,
              margin: '16px auto 0',
            }}
          >
            The complete core pipeline is free. Paid tiers add sharper ASR and more storage
            — never access to the basics.
          </p>
        </div>

        {/* Billing toggle */}
        <div
          data-reveal=""
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            marginBottom: 38,
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: 4,
              borderRadius: 9999,
              background: '#111118',
              border: '1px solid #1E1E2E',
            }}
          >
            <button
              type="button"
              onClick={() => setBilling('monthly')}
              style={{
                ...segBase,
                background: yearly ? 'transparent' : '#6366F1',
                color: yearly ? '#94A3B8' : '#09090F',
              }}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBilling('yearly')}
              style={{
                ...segBase,
                background: yearly ? '#6366F1' : 'transparent',
                color: yearly ? '#09090F' : '#94A3B8',
              }}
            >
              Yearly{' '}
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: '2px 7px',
                  borderRadius: 9999,
                  background: yearly
                    ? 'rgba(9,9,15,0.22)'
                    : 'rgba(99,102,241,0.18)',
                  color: yearly ? '#09090F' : '#A5B4FC',
                }}
              >
                Save 25%
              </span>
            </button>
          </div>
          <p style={{ fontSize: 12.5, color: '#5B6478', margin: 0, letterSpacing: '0.01em' }}>
            {yearly
              ? 'Billed annually · three months free vs. paying monthly'
              : 'Switch to yearly to save 25% — like three months free'}
          </p>
        </div>

        {/* Plan cards */}
        <div
          data-reveal=""
          data-cards-3=""
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3,1fr)',
            gap: 18,
            alignItems: 'start',
          }}
        >
          {PLAN_SRC.map((p) => {
            const free = p.monthly === 0
            const perMo = yearly ? p.monthly * 0.75 : p.monthly
            const annual = perMo * 12
            const saved = (p.monthly - perMo) * 12
            const showStrike = yearly && !free
            const showSave = yearly && !free

            return (
              <div
                key={p.name}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '26px 24px',
                  borderRadius: 12,
                  background: '#111118',
                  border:
                    '1px solid ' +
                    (p.hi ? 'rgba(99,102,241,0.4)' : '#1E1E2E'),
                  boxShadow: p.hi
                    ? '0 0 0 1px rgba(99,102,241,0.15), 0 16px 50px rgba(99,102,241,0.1)'
                    : 'none',
                  transition:
                    'transform .45s cubic-bezier(.22,1,.36,1), border-color .45s, box-shadow .45s',
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLDivElement).style.transform =
                    'translateY(-6px)'
                  ;(e.currentTarget as HTMLDivElement).style.boxShadow =
                    '0 26px 60px -28px rgba(0,0,0,0.8)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLDivElement).style.transform = 'none'
                  ;(e.currentTarget as HTMLDivElement).style.boxShadow = p.hi
                    ? '0 0 0 1px rgba(99,102,241,0.15), 0 16px 50px rgba(99,102,241,0.1)'
                    : 'none'
                }}
              >
                {/* Name + badge */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{ fontSize: 17, fontWeight: 600, color: '#E2E8F0' }}
                  >
                    {p.name}
                  </span>
                  {p.badge && (
                    <span
                      style={{
                        fontSize: 10.5,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        padding: '3px 9px',
                        borderRadius: 9999,
                        background: 'rgba(99,102,241,0.18)',
                        color: '#A5B4FC',
                        border: '1px solid rgba(99,102,241,0.3)',
                      }}
                    >
                      {p.badge}
                    </span>
                  )}
                </div>

                {/* Price */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 8,
                    marginBottom: 5,
                  }}
                >
                  {showStrike && (
                    <span
                      style={{
                        fontSize: 18,
                        fontWeight: 500,
                        color: '#5B6478',
                        textDecoration: 'line-through',
                        textDecorationColor: '#6366F1',
                      }}
                    >
                      ${p.monthly}
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: 34,
                      fontWeight: 600,
                      letterSpacing: '-0.02em',
                      color: '#E2E8F0',
                    }}
                  >
                    {free ? '$0' : `$${perMo}`}
                  </span>
                  <span style={{ fontSize: 13, color: '#5B6478' }}>
                    {free ? 'forever' : '/mo'}
                  </span>
                </div>

                {/* Sub line */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    minHeight: 21,
                    marginBottom: 16,
                  }}
                >
                  <span style={{ fontSize: 12, color: '#5B6478' }}>
                    {free
                      ? 'Free forever — no card needed'
                      : yearly
                      ? `$${annual} billed yearly`
                      : `$${annual}/yr billed monthly`}
                  </span>
                  {showSave && (
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 600,
                        letterSpacing: '0.03em',
                        padding: '2px 7px',
                        borderRadius: 9999,
                        background: 'rgba(99,102,241,0.16)',
                        color: '#A5B4FC',
                        border: '1px solid rgba(99,102,241,0.3)',
                      }}
                    >
                      Save ${saved}/yr
                    </span>
                  )}
                </div>

                {/* Tagline */}
                <p style={{ fontSize: 13.5, color: '#94A3B8', margin: '0 0 20px' }}>
                  {p.tagline}
                </p>

                {/* CTA */}
                <Link
                  href={p.href}
                  data-btn=""
                  data-shine=""
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    height: 40,
                    borderRadius: 7,
                    fontSize: 14,
                    fontWeight: p.primary ? 600 : 500,
                    background: p.primary ? '#6366F1' : 'transparent',
                    color: p.primary ? '#09090F' : '#E2E8F0',
                    border: p.primary ? 'none' : '1px solid #2D2B45',
                    boxShadow: p.primary
                      ? '0 8px 26px rgba(99,102,241,0.32)'
                      : 'none',
                    textDecoration: 'none',
                  }}
                >
                  {p.cta}
                </Link>

                {/* Features */}
                <ul
                  style={{
                    listStyle: 'none',
                    margin: '20px 0 0',
                    padding: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 11,
                  }}
                >
                  {p.features.map((f) => (
                    <li
                      key={f}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        fontSize: 13.5,
                        lineHeight: 1.5,
                        color: '#94A3B8',
                      }}
                    >
                      <span
                        style={{
                          marginTop: 2,
                          flexShrink: 0,
                          color: p.hi ? '#818CF8' : '#6366F1',
                          fontSize: 12,
                        }}
                      >
                        ✓
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>

      </div>
    </section>
  )
}
