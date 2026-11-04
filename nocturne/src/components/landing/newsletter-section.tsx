'use client'

import { useState, useRef } from 'react'

export function NewsletterSection() {
  const [subscribed, setSubscribed] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)

  const onSubscribe = () => {
    const val = emailRef.current?.value.trim() ?? ''
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      setSubscribed(true)
    }
  }

  return (
    <section
      id="newsletter"
      style={{
        scrollMarginTop: 64,
        padding: 'clamp(56px,7vw,88px) clamp(20px,4vw,40px)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        background: '#0C0C0D',
      }}
    >
      <div style={{ maxWidth: 540, margin: '0 auto', textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.16em', color: '#FF3B30', margin: '0 0 12px' }}>
          STAY IN THE LOOP
        </p>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontStretch: '82%',
            fontSize: 'clamp(24px,3vw,30px)',
            fontWeight: 600,
            letterSpacing: '-0.02em',
            margin: '0 0 10px',
            color: '#EDEDED',
          }}
        >
          Be first to know.
        </h2>
        <p style={{ fontSize: 14, color: '#9A9A9F', margin: '0 0 24px' }}>
          Beta updates, feature releases, and study tips for STEM students. No spam.
          Unsubscribe anytime.
        </p>

        {subscribed ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              padding: 14,
              border: '1px solid rgba(255,255,255,0.14)',
              background: 'rgba(255,255,255,0.03)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <span style={{ color: '#EDEDED' }}>[✓]</span>
            <span style={{ fontSize: 14, color: '#EDEDED', fontFamily: 'var(--font-sans)' }}>
              Check your inbox to confirm your subscription.
            </span>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, maxWidth: 440, margin: '0 auto' }}>
              <input
                ref={emailRef}
                type="email"
                placeholder="your@university.edu"
                onKeyDown={(e) => e.key === 'Enter' && onSubscribe()}
                className="newsletter-input"
                style={{
                  flex: 1,
                  height: 44,
                  padding: '0 14px',
                  background: '#111112',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#EDEDED',
                  outline: 'none',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
              />
              <button
                type="button"
                onClick={onSubscribe}
                style={{
                  height: 44,
                  padding: '0 22px',
                  background: '#FF3B30',
                  color: '#0A0A0A',
                  fontSize: 14,
                  fontWeight: 500,
                  border: 'none',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'background .2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#FF5147' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#FF3B30' }}
              >
                Subscribe
              </button>
            </div>
            <p style={{ fontSize: 12, color: '#76767B', margin: '14px 0 0' }}>
              We never share your email. View our Privacy Policy.
            </p>
          </>
        )}
      </div>

      <style>{`
        .newsletter-input { font-size: 14px; }
        @media (max-width: 767px) {
          .newsletter-input { font-size: 16px; }
        }
      `}</style>
    </section>
  )
}
