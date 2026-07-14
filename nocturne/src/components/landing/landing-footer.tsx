'use client'

import Link from 'next/link'

const FOOTER_COLS = [
  {
    heading: 'Product',
    links: [
      { label: 'Pricing', href: '/pricing' },
      { label: 'Security', href: '/security' },
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
    heading: 'Legal',
    links: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
      { label: 'Cookies', href: '/cookies' },
    ],
  },
  {
    heading: 'Support',
    links: [
      { label: 'Help', href: '/help' },
      { label: 'Contact', href: '/contact' },
      { label: 'Accessibility', href: '/accessibility' },
    ],
  },
]

export function LandingFooter() {
  return (
    <footer style={{ borderTop: '1px solid #191827', padding: '56px 24px 40px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Link columns */}
        <div
          data-footer-grid=""
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4,1fr)',
            gap: 32,
            marginBottom: 48,
          }}
        >
          {FOOTER_COLS.map((col) => (
            <div key={col.heading}>
              <p
                style={{
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: '#5B6478',
                  margin: '0 0 16px',
                }}
              >
                {col.heading}
              </p>
              <ul
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 11,
                }}
              >
                {col.links.map(({ label, href }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      style={{
                        fontSize: 14,
                        color: '#94A3B8',
                        textDecoration: 'none',
                        transition: 'color .2s',
                      }}
                      onMouseEnter={(e) => {
                        ;(e.target as HTMLAnchorElement).style.color = '#E2E8F0'
                      }}
                      onMouseLeave={(e) => {
                        ;(e.target as HTMLAnchorElement).style.color = '#94A3B8'
                      }}
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div
          style={{
            paddingTop: 28,
            borderTop: '1px solid #191827',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: 'linear-gradient(145deg,#6366F1,#8B5CF6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#09090F',
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              N
            </span>
            <div>
              <p style={{ fontSize: 12, color: '#5B6478', margin: 0 }}>
                © 2026 Nocturne
              </p>
              <p style={{ fontSize: 12, color: '#5B6478', margin: 0 }}>
                Not a note-taker. A study intelligence system.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <a
              href="https://github.com/nocturne"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 12,
                color: '#5B6478',
                textDecoration: 'none',
                transition: 'color .2s',
              }}
              onMouseEnter={(e) => {
                ;(e.target as HTMLAnchorElement).style.color = '#94A3B8'
              }}
              onMouseLeave={(e) => {
                ;(e.target as HTMLAnchorElement).style.color = '#5B6478'
              }}
            >
              GitHub
            </a>
            <a
              href="https://twitter.com/nocturne"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 12,
                color: '#5B6478',
                textDecoration: 'none',
                transition: 'color .2s',
              }}
              onMouseEnter={(e) => {
                ;(e.target as HTMLAnchorElement).style.color = '#94A3B8'
              }}
              onMouseLeave={(e) => {
                ;(e.target as HTMLAnchorElement).style.color = '#5B6478'
              }}
            >
              X / Twitter
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
