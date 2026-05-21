import Link from 'next/link'

const columns = [
  {
    heading: 'Product',
    links: [
      { label: 'Pricing', href: '/pricing' },
      { label: 'Security', href: '/security' },
      { label: 'Roadmap', href: '/roadmap' },
      { label: 'Newsletter', href: '/#newsletter' },
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

export function Footer() {
  return (
    <footer className="border-t border-border-subtle px-6 pt-12 pb-8">
      <div className="max-w-5xl mx-auto">
        {/* Four-column link grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {columns.map((col) => (
            <div key={col.heading}>
              <p className="text-caption uppercase tracking-[0.07em] text-text-tertiary mb-4">
                {col.heading}
              </p>
              <ul className="flex flex-col gap-2.5">
                {col.links.map(({ label, href }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="text-body-sm text-text-secondary hover:text-text-primary transition-colors"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom row */}
        <div className="pt-6 border-t border-border-subtle flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* E monogram + copyright + tagline */}
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-btn bg-indigo-500 flex items-center justify-center text-text-inverse text-[13px] font-semibold select-none shrink-0">
              N
            </div>
            <div>
              <p className="text-caption text-text-tertiary">
                © {new Date().getFullYear()} Nocturne
              </p>
              <p className="text-caption text-text-tertiary">
                Not a note-taker. A study intelligence system.
              </p>
            </div>
          </div>

          {/* Social links */}
          <div className="flex items-center gap-4">
            {/* TODO: confirm final domain / social handles before launch */}
            <a
              href="https://github.com/nocturne"
              target="_blank"
              rel="noopener noreferrer"
              className="text-caption text-text-tertiary hover:text-text-secondary transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://twitter.com/nocturne"
              target="_blank"
              rel="noopener noreferrer"
              className="text-caption text-text-tertiary hover:text-text-secondary transition-colors"
            >
              X / Twitter
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
