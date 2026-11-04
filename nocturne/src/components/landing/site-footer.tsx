'use client'

import Link from 'next/link'
import { EclipseMark } from '@/components/surgical/eclipse-mark'

const FOOTER_COLS = [
  {
    heading: 'Product',
    links: [
      { label: 'Pricing', href: '#pricing' },
      { label: 'Roadmap', href: '/roadmap' },
      { label: 'Newsletter', href: '#newsletter' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Blog', href: '/blog' },
      { label: 'Changelog', href: '/changelog' },
    ],
  },
  {
    heading: 'Use Cases',
    links: [
      { label: 'For Pre-Med', href: '/for/pre-med' },
      { label: 'For Engineering', href: '/for/engineering' },
      { label: 'For Law', href: '/for/law' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
      { label: 'Cookies', href: '/cookies' },
      { label: 'Security', href: '/security' },
    ],
  },
  {
    heading: 'Support',
    links: [
      { label: 'Help', href: '/help' },
      { label: 'Community', href: '/community' },
      { label: 'Contact', href: '/contact' },
      { label: 'Accessibility', href: '/accessibility' },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '56px clamp(20px,4vw,40px) 40px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div data-footer-grid className="footer-grid" style={{ display: 'grid', gap: 32, marginBottom: 48 }}>
          {FOOTER_COLS.map((col) => (
            <div key={col.heading}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em', color: '#76767B', margin: '0 0 16px' }}>
                {col.heading.toUpperCase()}
              </p>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
                {col.links.map(({ label, href }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      style={{ fontSize: 14, color: '#9A9A9F', textDecoration: 'none', transition: 'color .2s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#EDEDED' }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = '#9A9A9F' }}
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          style={{
            paddingTop: 28,
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em', color: '#76767B' }}>
            <EclipseMark size={16} />
            <span>© 2026 NOCTURNE</span>
          </div>
          <p style={{ fontSize: 12, color: '#5E5E62', margin: 0 }}>Not a note-taker. A study intelligence system.</p>
        </div>
      </div>

      <style>{`
        .footer-grid { grid-template-columns: repeat(5,1fr); }
        @media (max-width: 767px) {
          .footer-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
        }
      `}</style>
    </footer>
  )
}
