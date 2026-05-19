'use client'

import { useEffect, useState } from 'react'
import { LayoutDashboard, Plus, Settings, ChevronLeft, ChevronRight } from 'lucide-react'
import { NavItem } from './nav-item'
import { PrivacyBadge } from './privacy-badge'
import { StorageIndicator } from './storage-indicator'
import { UserRow } from './user-row'
import { NotificationStrip } from './notification-strip'

const NAV_ITEMS = [
  { href: '/vault', icon: LayoutDashboard, label: 'Vault' },
  { href: '/session/new', icon: Plus, label: 'New session' },
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

  useEffect(() => {
    // Read collapse state only on client to avoid hydration mismatch
    const saved = localStorage.getItem('echograph-nav-collapsed')
    if (saved === 'true') setCollapsed(true)
    setMounted(true)
  }, [])

  function toggleCollapse() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('echograph-nav-collapsed', String(next))
  }

  // Render consistent width on server to avoid hydration shift; collapse applied after mount
  const width = mounted ? (collapsed ? 'w-12' : 'w-[220px]') : 'w-[220px]'

  return (
    <nav
      className={[
        'flex flex-col h-screen sticky top-0 bg-bg-elevated border-r border-border-default shrink-0 overflow-hidden',
        width,
      ].join(' ')}
    >
      {/* Wordmark + collapse toggle */}
      <div className="flex items-center justify-between h-14 px-3 border-b border-border-subtle shrink-0">
        {!collapsed && (
          <span className="text-subheading font-medium text-text-primary select-none truncate">
            EchoGraph
          </span>
        )}
        {collapsed && (
          <span className="text-subheading font-medium text-text-primary select-none mx-auto">
            E
          </span>
        )}
        {!collapsed && (
          <button
            type="button"
            onClick={toggleCollapse}
            aria-label="Collapse navigation"
            className="w-7 h-7 flex items-center justify-center rounded-btn text-text-tertiary hover:text-text-secondary hover:bg-bg-subtle transition-colors shrink-0"
          >
            <ChevronLeft size={16} strokeWidth={1.5} />
          </button>
        )}
        {collapsed && (
          <button
            type="button"
            onClick={toggleCollapse}
            aria-label="Expand navigation"
            className="w-7 h-7 flex items-center justify-center rounded-btn text-text-tertiary hover:text-text-secondary hover:bg-bg-subtle transition-colors absolute bottom-4 right-2"
          >
            <ChevronRight size={16} strokeWidth={1.5} />
          </button>
        )}
      </div>

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
      <div className="flex flex-col gap-3 p-3 border-t border-border-subtle pb-4">
        <PrivacyBadge collapsed={collapsed} />

        {!collapsed && (
          <>
            <StorageIndicator usedBytes={usedBytes} maxBytes={FREE_MAX_BYTES} />
            <UserRow email={email} />
          </>
        )}
      </div>
    </nav>
  )
}
