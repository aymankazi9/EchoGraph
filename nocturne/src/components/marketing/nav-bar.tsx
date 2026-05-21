'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { AnimatePresence } from 'framer-motion'
import { MobileNav } from './mobile-nav'

export const navLinks = [
  { label: 'Pricing', href: '/pricing', soon: false },
  { label: 'Security', href: '/security', soon: false },
  { label: 'About', href: '/about', soon: false },
  { label: 'Blog', href: '/blog', soon: true },
]

export function NavBar() {
  const [scrolled, setScrolled] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close mobile nav on route change
  useEffect(() => { setIsOpen(false) }, [pathname])

  return (
    <>
      <header
        className={[
          'sticky top-0 z-30 w-full px-6 h-14 flex items-center justify-between',
          'bg-bg-base/80 backdrop-blur transition-colors duration-200',
          scrolled ? 'border-b border-border-subtle' : 'border-b border-transparent',
        ].join(' ')}
      >
        {/* Wordmark */}
        <Link href="/" className="text-subheading font-medium text-text-primary select-none">
          Nocturne
        </Link>

        {/* Center nav — desktop only */}
        <nav className="hidden lg:flex items-center gap-1" aria-label="Main navigation">
          {navLinks.map(({ label, href, soon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={[
                  'relative h-9 px-3.5 inline-flex items-center gap-1.5 rounded-btn text-body transition-colors',
                  active
                    ? 'text-text-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-subtle',
                ].join(' ')}
              >
                {label}
                {soon && (
                  <span className="text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-amber-400/10 text-amber-200">
                    Soon
                  </span>
                )}
                {active && (
                  <span className="absolute bottom-1 left-3.5 right-3.5 h-px bg-indigo-500 rounded-full" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden lg:inline-flex h-9 px-4 items-center rounded-btn text-body text-text-secondary hover:bg-bg-subtle transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/login"
            className="hidden sm:inline-flex h-9 px-4 items-center rounded-btn text-body font-medium bg-indigo-500 text-text-inverse hover:bg-indigo-600 transition-colors"
          >
            Get started
          </Link>

          {/* Hamburger — below lg only */}
          <button
            type="button"
            className="lg:hidden h-9 w-9 flex items-center justify-center rounded-btn text-text-secondary hover:bg-bg-subtle transition-colors"
            aria-label={isOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isOpen}
            onClick={() => setIsOpen((v) => !v)}
          >
            {isOpen ? <X size={18} strokeWidth={1.5} /> : <Menu size={18} strokeWidth={1.5} />}
          </button>
        </div>
      </header>

      <AnimatePresence>
        {isOpen && <MobileNav onClose={() => setIsOpen(false)} />}
      </AnimatePresence>
    </>
  )
}
