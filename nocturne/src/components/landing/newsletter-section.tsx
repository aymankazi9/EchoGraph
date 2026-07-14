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
        scrollMarginTop: 80,
        padding: 'clamp(56px,7vw,88px) 24px',
        borderTop: '1px solid #1E1E2E',
        background: '#111118',
      }}
    >
      <div data-reveal="" style={{ maxWidth: 540, margin: '0 auto', textAlign: 'center' }}>
        <p
          style={{
            fontSize: 12,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: '#818CF8',
            margin: '0 0 12px',
          }}
        >
          Stay in the loop
        </p>
        <h2
          style={{
            fontSize: 'clamp(24px,3vw,30px)',
            fontWeight: 600,
            letterSpacing: '-0.02em',
            margin: '0 0 10px',
            color: '#E2E8F0',
          }}
        >
          Be first to know.
        </h2>
        <p style={{ fontSize: 14, color: '#94A3B8', margin: '0 0 24px' }}>
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
              borderRadius: 9,
              border: '1px solid rgba(99,102,241,0.35)',
              background: 'rgba(99,102,241,0.08)',
            }}
          >
            <span style={{ color: '#818CF8' }}>✓</span>
            <span style={{ fontSize: 14, color: '#E2E8F0' }}>
              Check your inbox to confirm your subscription.
            </span>
          </div>
        ) : (
          <>
            <div
              style={{
                display: 'flex',
                gap: 8,
                maxWidth: 440,
                margin: '0 auto',
              }}
            >
              <input
                ref={emailRef}
                type="email"
                placeholder="your@university.edu"
                onKeyDown={(e) => e.key === 'Enter' && onSubscribe()}
                style={{
                  flex: 1,
                  height: 44,
                  padding: '0 14px',
                  borderRadius: 7,
                  background: '#13121C',
                  border: '1px solid #1E1E2E',
                  color: '#E2E8F0',
                  fontSize: 14,
                  outline: 'none',
                }}
                onFocus={(e) => {
                  ;(e.target as HTMLInputElement).style.borderColor = '#6366F1'
                }}
                onBlur={(e) => {
                  ;(e.target as HTMLInputElement).style.borderColor = '#1E1E2E'
                }}
              />
              <button
                type="button"
                onClick={onSubscribe}
                data-btn=""
                data-shine=""
                style={{
                  height: 44,
                  padding: '0 22px',
                  borderRadius: 7,
                  background: '#6366F1',
                  color: '#09090F',
                  fontSize: 14,
                  fontWeight: 500,
                  border: 'none',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                Subscribe
              </button>
            </div>
            <p style={{ fontSize: 12, color: '#5B6478', margin: '14px 0 0' }}>
              We never share your email. View our Privacy Policy.
            </p>
          </>
        )}
      </div>
    </section>
  )
}
