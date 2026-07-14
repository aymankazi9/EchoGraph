'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        width: '100%',
        backgroundColor: scrolled ? 'rgba(9,9,15,0.82)' : 'rgba(9,9,15,0)',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: '1px solid ' + (scrolled ? '#191827' : 'transparent'),
        transition: 'background-color .25s, border-color .25s',
      }}
    >
      <div
        style={{
          maxWidth: 1160,
          margin: '0 auto',
          padding: '0 24px',
          height: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Logo */}
        <Link
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            textDecoration: 'none',
          }}
        >
          <span
            style={{
              width: 24,
              height: 24,
              borderRadius: 7,
              background: 'linear-gradient(145deg,#6366F1,#8B5CF6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#09090F',
              fontWeight: 700,
              fontSize: 13,
              boxShadow: '0 0 0 1px rgba(99,102,241,0.4), 0 4px 14px rgba(99,102,241,0.35)',
            }}
          >
            N
          </span>
          <span
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: '#E2E8F0',
              letterSpacing: '-0.01em',
            }}
          >
            Nocturne
          </span>
        </Link>

        {/* Desktop nav links */}
        <nav
          data-desktop="nav"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {[
            { label: 'How it works', href: '#how' },
            { label: 'Features', href: '#features' },
            { label: 'Security', href: '#privacy' },
            { label: 'Pricing', href: '#pricing' },
          ].map(({ label, href }) => (
            <a
              key={href}
              href={href}
              data-navlink=""
              style={{
                height: 34,
                padding: '0 12px',
                display: 'inline-flex',
                alignItems: 'center',
                fontSize: 14,
                color: '#94A3B8',
                textDecoration: 'none',
              }}
            >
              {label}
            </a>
          ))}
        </nav>

        {/* CTA buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link
            href="/login"
            data-btn=""
            data-desktop="signin"
            style={{
              height: 34,
              padding: '0 14px',
              display: 'inline-flex',
              alignItems: 'center',
              fontSize: 14,
              color: '#94A3B8',
              textDecoration: 'none',
              borderRadius: 6,
            }}
          >
            Sign in
          </Link>
          <Link
            href="/setup"
            data-btn=""
            data-shine=""
            style={{
              height: 34,
              padding: '0 16px',
              display: 'inline-flex',
              alignItems: 'center',
              fontSize: 14,
              fontWeight: 500,
              color: '#09090F',
              background: '#6366F1',
              borderRadius: 6,
              textDecoration: 'none',
            }}
          >
            Get started
          </Link>
        </div>
      </div>
    </nav>
  )
}
