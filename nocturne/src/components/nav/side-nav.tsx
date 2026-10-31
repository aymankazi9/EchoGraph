'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { LayoutDashboard, Plus, Settings, ChevronLeft, ChevronRight, Flame, Users, HelpCircle, CreditCard, Sparkles, ScrollText } from 'lucide-react'
import { STORAGE_CAPS_BYTES, type Tier } from '@/lib/tiers/features'
import { EclipseMark } from '@/components/surgical/eclipse-mark'
import { useFocusMode } from '@/components/surgical/use-focus-mode'
import { FocusToast } from '@/components/surgical/focus-toast'
import { NavItem } from './nav-item'
import { PrivacyBadge } from './privacy-badge'
import { StorageIndicator } from './storage-indicator'
import { UserRow } from './user-row'
import { NotificationStrip } from './notification-strip'

const NAV_ITEMS = [
  { href: '/vault',          icon: LayoutDashboard, label: 'Vault' },
  { href: '/vault/ask',      icon: Sparkles,        label: 'Vault Ask' },
  { href: '/momentum',       icon: Flame,           label: 'Momentum', beta: true },
  { href: '/community',      icon: Users,           label: 'Community', beta: true, betaHidden: true },
  { href: '/session/new',    icon: Plus,            label: 'New session' },
  { href: '/help',           icon: HelpCircle,      label: 'Help' },
  { href: '/billing',        icon: CreditCard,      label: 'Billing' },
  { href: '/vault/settings', icon: Settings,        label: 'Settings' },
]

const IS_BETA = process.env.NEXT_PUBLIC_BETA_MODE === 'true'

interface Props {
  email: string
  usedBytes: number
  tier: Tier
}

export function SideNav({ email, usedBytes, tier }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [animationReady, setAnimationReady] = useState(false)
  const { toastOn, toggleFocus } = useFocusMode()

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
    <>
    <motion.nav
      animate={{ width: mounted ? (collapsed ? 64 : 232) : 232 }}
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
          Expanded: icon + wordmark on the left, chevron on the right.
          The eclipse mark also doubles as the in-app "3 AM Deep Focus Mode" trigger. */}
      {collapsed ? (
        <div className="flex items-center justify-center h-14 border-b border-border-subtle shrink-0">
          <button
            type="button"
            onClick={toggleCollapse}
            aria-label="Expand navigation"
            className="w-10 h-10 flex items-center justify-center hover:bg-bg-subtle transition-colors"
          >
            <EclipseMark size={24} />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between h-14 px-3 border-b border-border-subtle shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              type="button"
              data-logo-btn=""
              onClick={toggleFocus}
              aria-label="Toggle 3 AM Deep Focus Mode"
              className="flex shrink-0"
              style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
            >
              <EclipseMark size={24} />
            </button>
            <span className="select-none truncate" style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, letterSpacing: '0.34em', color: 'var(--color-text-primary)' }}>
              NOCTURNE
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

        {/* Beta Guide — pinned first, amber-accented, only shown during beta */}
        {IS_BETA && (
          <>
            <NavItem
              href="/beta-guide"
              icon={ScrollText}
              label="Beta Guide"
              collapsed={collapsed}
              guide
            />
            {/* Subtle separator between the guide item and the main workspace nav */}
            {!collapsed && (
              <div style={{
                margin: '3px 4px',
                borderTop: '1px solid rgba(255,255,255,0.04)',
              }} />
            )}
          </>
        )}

        {NAV_ITEMS
          .filter(item => !(IS_BETA && item.betaHidden))
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
    <FocusToast show={toastOn} />
    </>
  )
}
