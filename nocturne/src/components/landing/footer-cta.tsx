'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { useContourField } from '@/components/surgical/use-contour-field'
import { EclipseMark } from '@/components/surgical/eclipse-mark'

// Beta mode: primary CTA scrolls to the beta-request form instead of /setup.
const IS_BETA = process.env.NEXT_PUBLIC_BETA_MODE === 'true'

// The reference bundles this CTA and its nav-link footer into one <footer id="start">. Here the
// CTA is its own section — FAQ/Newsletter/BetaRequest land between it and the real <footer>
// landmark (SiteFooter) so the page keeps exactly one footer role.
export function FooterCta() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useContourField(canvasRef, { variant: 'footer' })

  return (
    <section id="start" style={{ position: 'relative', overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
      <div
        data-fade="ft"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 60% 70% at 50% 45%, rgba(10,10,10,0.92), rgba(10,10,10,0.2))',
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative', padding: 'clamp(120px,14vw,200px) clamp(20px,4vw,40px)', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 640, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30, textAlign: 'center' }}>
          <EclipseMark size={56} />
          <h2
            style={{
              margin: 0,
              fontFamily: 'var(--font-display)',
              fontStretch: '82%',
              fontWeight: 600,
              fontSize: 'clamp(40px,5.4vw,76px)',
              lineHeight: 0.96,
              letterSpacing: '-0.035em',
              textWrap: 'balance',
            }}
          >
            Stop re-reading everything.
          </h2>
          {IS_BETA ? (
            <a
              href="#beta-request"
              onClick={(e) => {
                e.preventDefault()
                document.getElementById('beta-request')?.scrollIntoView({ behavior: 'smooth' })
              }}
              style={{
                height: 50,
                padding: '0 26px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 12,
                background: '#FF3B30',
                color: '#0A0A0A',
                fontSize: 15,
                fontWeight: 500,
                transition: 'background .2s',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#FF5147' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#FF3B30' }}
            >
              Request beta access <span style={{ fontFamily: 'var(--font-mono)' }}>→</span>
            </a>
          ) : (
            <Link
              href="/setup"
              style={{
                height: 50,
                padding: '0 26px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 12,
                background: '#FF3B30',
                color: '#0A0A0A',
                fontSize: 15,
                fontWeight: 500,
                transition: 'background .2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#FF5147' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#FF3B30' }}
            >
              Start Mastering Faster <span style={{ fontFamily: 'var(--font-mono)' }}>→</span>
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}
