'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { navLinks } from './nav-bar'

interface Props {
  onClose: () => void
}

export function MobileNav({ onClose }: Props) {
  const pathname = usePathname()

  return (
    <>
      {/* Backdrop — z-20, behind the dropdown at z-30 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-20 bg-bg-base/40"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Dropdown — z-30, anchored just below the sticky header (h-14 = top-14) */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2, ease: [0.0, 0.0, 0.2, 1.0] }}
        className="fixed top-14 left-0 right-0 z-30 bg-bg-base border-b border-border-subtle px-4 pb-4"
      >
        <nav className="flex flex-col gap-0.5 pt-2" aria-label="Mobile navigation">
          {navLinks.map(({ label, href, soon }) => (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={[
                'flex items-center gap-2 h-10 px-3 rounded-btn text-body transition-colors',
                pathname === href
                  ? 'text-text-primary bg-bg-subtle'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-subtle',
              ].join(' ')}
            >
              {label}
              {soon && (
                <span className="text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-amber-400/10 text-amber-200">
                  Soon
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="mt-3 pt-3 border-t border-border-subtle flex flex-col gap-2">
          <Link
            href="/login"
            onClick={onClose}
            className="h-9 flex items-center justify-center rounded-btn text-body text-text-secondary border border-border-default hover:bg-bg-subtle transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/login"
            onClick={onClose}
            className="h-9 flex items-center justify-center rounded-btn text-body font-medium bg-indigo-500 text-text-inverse hover:bg-indigo-600 transition-colors"
          >
            Get started
          </Link>
        </div>
      </motion.div>
    </>
  )
}
