'use client'

import { useEffect, useRef, useState } from 'react'
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

function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      {open ? (
        <path d="M5 5L15 15M15 5L5 15" stroke="#EDEDED" strokeWidth="1.5" strokeLinecap="round" />
      ) : (
        <>
          <path d="M3 6H17" stroke="#EDEDED" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M3 10H17" stroke="#EDEDED" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M3 14H17" stroke="#EDEDED" strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}
    </svg>
  )
}

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const { focus, toastOn, toggleFocus } = useFocusMode()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Scroll lock + focus trap + Escape-to-close while the mobile menu is open.
  useEffect(() => {
    if (!menuOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusable = panelRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')
    focusable?.[0]?.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        triggerRef.current?.focus()
        return
      }
      if (e.key !== 'Tab' || !focusable || focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  function closeMenu() {
    setMenuOpen(false)
    triggerRef.current?.focus()
  }

  function handleMobileCtaClick(e: React.MouseEvent) {
    if (IS_BETA) {
      e.preventDefault()
      document.getElementById('beta-request')?.scrollIntoView({ behavior: 'smooth' })
    }
    closeMenu()
  }

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
          className="site-header-bar"
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

          <nav data-nav-links className="site-header-desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
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
            <div className="site-header-desktop-cta" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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

            <button
              type="button"
              ref={triggerRef}
              className="site-header-trigger"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-controls="site-header-mobile-panel"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            >
              <HamburgerIcon open={menuOpen} />
            </button>
          </div>
        </div>
      </header>

      <div
        id="site-header-mobile-panel"
        ref={panelRef}
        className="site-header-mobile-panel"
        data-open={menuOpen}
        role="dialog"
        aria-modal="true"
        aria-label="Site navigation"
      >
        <nav style={{ display: 'flex', flexDirection: 'column' }}>
          {NAV_LINKS.map(({ label, href }) => (
            <a
              key={href}
              href={href}
              onClick={closeMenu}
              style={{
                height: 52,
                display: 'flex',
                alignItems: 'center',
                fontSize: 16,
                color: '#CFCFD2',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {label}
            </a>
          ))}
        </nav>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
          <Link
            href="/login"
            onClick={closeMenu}
            style={{
              height: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(255,255,255,0.14)',
              color: '#EDEDED',
              fontSize: 15,
            }}
          >
            Log in
          </Link>
          <a
            href={IS_BETA ? '#beta-request' : '/setup'}
            onClick={handleMobileCtaClick}
            style={{
              height: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              background: '#FF3B30',
              color: '#0A0A0A',
              fontSize: 15,
              fontWeight: 500,
            }}
          >
            {IS_BETA ? 'Request beta access' : 'Get started'}
          </a>
        </div>
      </div>

      <style>{`
        .site-header-trigger {
          display: none;
          width: 44px;
          height: 44px;
          align-items: center;
          justify-content: center;
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          flex-shrink: 0;
        }
        .site-header-mobile-panel { display: none; }
        @media (max-width: 1023px) {
          .site-header-desktop-nav,
          .site-header-desktop-cta {
            display: none !important;
          }
          .site-header-trigger { display: flex; }
          .site-header-bar {
            padding-left: max(clamp(20px,4vw,40px), env(safe-area-inset-left));
            padding-right: max(clamp(20px,4vw,40px), env(safe-area-inset-right));
          }
          .site-header-mobile-panel[data-open="true"] {
            display: block;
            position: fixed;
            top: 64px;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 49;
            background: rgba(10,10,10,0.97);
            backdrop-filter: blur(14px);
            -webkit-backdrop-filter: blur(14px);
            overflow-y: auto;
            padding: 20px clamp(20px,4vw,40px);
            padding-left: max(clamp(20px,4vw,40px), env(safe-area-inset-left));
            padding-right: max(clamp(20px,4vw,40px), env(safe-area-inset-right));
            padding-bottom: max(20px, env(safe-area-inset-bottom));
          }
        }
      `}</style>

      <FocusToast show={toastOn} />
    </>
  )
}
