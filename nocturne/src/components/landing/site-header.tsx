'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { EclipseMark } from '@/components/surgical/eclipse-mark'
import { useFocusMode } from '@/components/surgical/use-focus-mode'
import { FocusToast } from '@/components/surgical/focus-toast'

// Beta mode: primary CTA scrolls to the beta-request form instead of /setup.
const IS_BETA = process.env.NEXT_PUBLIC_BETA_MODE === 'true'

const NAV_LINKS = [
  { label: 'Workflows', href: '#workflows' },
  { label: 'Architecture', href: '#architecture' },
  { label: 'Privacy', href: '#privacy' },
  { label: 'Pricing', href: '#pricing' },
]

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false)
  const { focus, toastOn, toggleFocus } = useFocusMode()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <header
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          background: scrolled ? (focus ? 'rgba(0,0,0,0.85)' : 'rgba(10,10,10,0.82)') : 'rgba(10,10,10,0)',
          backdropFilter: scrolled ? 'blur(14px)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(14px)' : 'none',
          borderBottom: '1px solid ' + (scrolled ? (focus ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)') : 'transparent'),
          transition: 'background-color .25s, border-color .25s',
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            padding: '0 clamp(20px,4vw,40px)',
            height: 64,
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            gap: 24,
          }}
        >
          <div style={{ justifySelf: 'start', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              data-logo-btn=""
              onClick={toggleFocus}
              aria-pressed={focus}
              aria-label="Toggle 3 AM Deep Focus Mode"
              title="3 AM"
              style={{
                padding: 0,
                margin: 0,
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                display: 'flex',
                transition: 'transform .3s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'rotate(-20deg)' }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'none' }}
            >
              <EclipseMark size={24} />
            </button>
            <Link href="/" style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.34em', color: '#EDEDED' }}>
              NOCTURNE
            </Link>
          </div>

          <nav data-nav-links style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
            {NAV_LINKS.map(({ label, href }) => (
              <a
                key={href}
                href={href}
                style={{ fontSize: 13, color: '#9A9A9F', transition: 'color .2s' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#EDEDED' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#9A9A9F' }}
              >
                {label}
              </a>
            ))}
          </nav>

          <div style={{ justifySelf: 'end', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Link
              href="/login"
              style={{
                height: 34,
                padding: '0 14px',
                display: 'inline-flex',
                alignItems: 'center',
                fontSize: 13,
                color: '#9A9A9F',
                whiteSpace: 'nowrap',
                transition: 'color .2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#EDEDED' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#9A9A9F' }}
            >
              Log in
            </Link>
            {IS_BETA ? (
              <a
                href="#beta-request"
                onClick={(e) => {
                  e.preventDefault()
                  document.getElementById('beta-request')?.scrollIntoView({ behavior: 'smooth' })
                }}
                style={{
                  height: 34,
                  padding: '0 14px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  background: '#FF3B30',
                  color: '#0A0A0A',
                  fontSize: 13,
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  transition: 'background .2s',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#FF5147' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#FF3B30' }}
              >
                Request beta access
              </a>
            ) : (
              <Link
                href="/setup"
                style={{
                  height: 34,
                  padding: '0 14px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  background: '#FF3B30',
                  color: '#0A0A0A',
                  fontSize: 13,
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  transition: 'background .2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#FF5147' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#FF3B30' }}
              >
                Get started <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>→</span>
              </Link>
            )}
          </div>
        </div>
      </header>
      <FocusToast show={toastOn} />
    </>
  )
}
