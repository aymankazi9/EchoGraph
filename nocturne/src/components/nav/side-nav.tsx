'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { LayoutDashboard, Plus, Settings, ChevronLeft, ChevronRight, Flame, Users, HelpCircle, CreditCard } from 'lucide-react'
import { NavItem } from './nav-item'
import { PrivacyBadge } from './privacy-badge'
import { StorageIndicator } from './storage-indicator'
import { UserRow } from './user-row'
import { NotificationStrip } from './notification-strip'

const NAV_ITEMS = [
  { href: '/vault', icon: LayoutDashboard, label: 'Vault' },
  { href: '/momentum', icon: Flame, label: 'Momentum' },
  { href: '/community', icon: Users, label: 'Community' },
  { href: '/session/new', icon: Plus, label: 'New session' },
  { href: '/help', icon: HelpCircle, label: 'Help' },
  { href: '/billing', icon: CreditCard, label: 'Billing' },
  { href: '/vault/settings', icon: Settings, label: 'Settings' },
]

// Free tier: 500 MB
const FREE_MAX_BYTES = 500 * 1024 * 1024

interface Props {
  email: string
  usedBytes: number
}

export function SideNav({ email, usedBytes }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [animationReady, setAnimationReady] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('nocturne-nav-collapsed')
    if (saved === 'true') setCollapsed(true)
    setMounted(true)
    // Enable smooth transitions only after initial width has settled
    const t = setTimeout(() => setAnimationReady(true), 50)
    return () => clearTimeout(t)
  }, [])

  function toggleCollapse() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('nocturne-nav-collapsed', String(next))
  }

  return (
    <motion.nav
      animate={{ width: mounted ? (collapsed ? 64 : 224) : 224 }}
      transition={
        animationReady
          ? { duration: 0.2, ease: [0.4, 0.0, 0.2, 1.0] }
          : { duration: 0 }
      }
      className="flex flex-col h-screen sticky top-0 bg-bg-rail border-r border-border-default shrink-0 overflow-hidden"
    >
      {/* Top: wordmark/monogram + collapse toggle */}
      {collapsed ? (
        <div className="flex flex-col items-center justify-center h-14 border-b border-border-subtle shrink-0 gap-1">
          <span className="text-subheading font-medium text-text-primary select-none">N</span>
          <button
            type="button"
            onClick={toggleCollapse}
            aria-label="Expand navigation"
            className="w-7 h-7 flex items-center justify-center rounded-btn text-text-tertiary hover:text-text-secondary hover:bg-bg-subtle transition-colors"
          >
            <ChevronRight size={14} strokeWidth={1.5} />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between h-14 px-3 border-b border-border-subtle shrink-0">
          <span className="text-subheading font-medium text-text-primary select-none truncate">
            Nocturne
          </span>
          <button
            type="button"
            onClick={toggleCollapse}
            aria-label="Collapse navigation"
            className="w-7 h-7 flex items-center justify-center rounded-btn text-text-tertiary hover:text-text-secondary hover:bg-bg-subtle transition-colors shrink-0"
          >
            <ChevronLeft size={16} strokeWidth={1.5} />
          </button>
        </div>
      )}

      {/* Nav items */}
      <div className="flex flex-col gap-0.5 p-2 flex-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label}
            collapsed={collapsed}
          />
        ))}
      </div>

      {/* Notification strip */}
      <NotificationStrip collapsed={collapsed} />

      {/* Bottom section */}
      {collapsed ? (
        <div className="flex flex-col items-center gap-3 p-3 border-t border-border-subtle pb-4">
          <PrivacyBadge collapsed={true} />
          <UserRow email={email} collapsed={true} />
        </div>
      ) : (
        <div className="flex flex-col gap-3 p-3 border-t border-border-subtle pb-4">
          <PrivacyBadge collapsed={false} />
          <StorageIndicator usedBytes={usedBytes} maxBytes={FREE_MAX_BYTES} />
          <UserRow email={email} />
        </div>
      )}
    </motion.nav>
  )
}
