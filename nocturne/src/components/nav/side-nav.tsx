'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { LayoutDashboard, Plus, Settings, ChevronLeft, ChevronRight, Flame, Users, HelpCircle, CreditCard } from 'lucide-react'
import { STORAGE_CAPS_BYTES, type Tier } from '@/lib/tiers/features'
import { NavItem } from './nav-item'
import { PrivacyBadge } from './privacy-badge'
import { StorageIndicator } from './storage-indicator'
import { UserRow } from './user-row'
import { NotificationStrip } from './notification-strip'

const NAV_ITEMS = [
  { href: '/vault', icon: LayoutDashboard, label: 'Vault' },
  { href: '/momentum', icon: Flame, label: 'Momentum', beta: true },
  { href: '/community', icon: Users, label: 'Community', beta: true, betaHidden: true },
  { href: '/session/new', icon: Plus, label: 'New session' },
  { href: '/help', icon: HelpCircle, label: 'Help' },
  { href: '/billing', icon: CreditCard, label: 'Billing' },
  { href: '/vault/settings', icon: Settings, label: 'Settings' },
]

interface Props {
  email: string
  usedBytes: number
  tier: Tier
}

export function SideNav({ email, usedBytes, tier }: Props) {
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
      {/* Top: brand icon + wordmark + collapse toggle.
          Single layout in both states so the icon never shifts vertically —
          items-center + h-14 keeps it locked to the same vertical band.
          Collapsed: icon is centered and acts as the expand button.
          Expanded: icon + wordmark on the left, chevron on the right. */}
      {collapsed ? (
        <div className="flex items-center justify-center h-14 border-b border-border-subtle shrink-0">
          <button
            type="button"
            onClick={toggleCollapse}
            aria-label="Expand navigation"
            className="w-10 h-10 flex items-center justify-center rounded-md hover:bg-bg-subtle transition-colors"
          >
            <span style={{
              width: 24, height: 24, borderRadius: 7,
              background: 'linear-gradient(145deg,#6366F1,#8B5CF6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#09090F', fontWeight: 700, fontSize: 13, flexShrink: 0,
              boxShadow: '0 0 0 1px rgba(99,102,241,0.4), 0 4px 14px rgba(99,102,241,0.35)',
              pointerEvents: 'none',
            }}>
              N
            </span>
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between h-14 px-3 border-b border-border-subtle shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <span style={{
              width: 24, height: 24, borderRadius: 7,
              background: 'linear-gradient(145deg,#6366F1,#8B5CF6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#09090F', fontWeight: 700, fontSize: 13, flexShrink: 0,
              boxShadow: '0 0 0 1px rgba(99,102,241,0.4), 0 4px 14px rgba(99,102,241,0.35)',
            }}>
              N
            </span>
            <span className="text-subheading font-medium text-text-primary select-none truncate">
              Nocturne
            </span>
          </div>
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
        {NAV_ITEMS
          .filter(item => !(process.env.NEXT_PUBLIC_BETA_MODE === 'true' && item.betaHidden))
          .map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              collapsed={collapsed}
              beta={item.beta}
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
          <StorageIndicator usedBytes={usedBytes} maxBytes={STORAGE_CAPS_BYTES[tier]} />
          <UserRow email={email} />
        </div>
      )}
    </motion.nav>
  )
}
