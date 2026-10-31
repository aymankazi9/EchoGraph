'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface Props {
  href: string
  icon: LucideIcon
  label: string
  collapsed: boolean
  beta?: boolean
  /**
   * Renders the item with a permanent tint (active or not) — used exclusively for the Beta
   * Guide nav item to visually signal that it's an informational page, not a workspace tab.
   */
  guide?: boolean
}

export function NavItem({ href, icon: Icon, label, collapsed, beta, guide }: Props) {
  const pathname = usePathname()
  const isActive = pathname === href || (href !== '/vault' && pathname.startsWith(href))

  const active = isActive || guide

  const inner = (
    <Link
      href={href}
      data-navitem
      style={{
        background: active ? 'rgba(255,255,255,0.05)' : undefined,
        color: active ? '#EDEDED' : '#9A9A9F',
        boxShadow: active ? 'inset 2px 0 0 var(--color-accent)' : undefined,
      }}
      className={[
        'flex items-center gap-3 transition-colors',
        collapsed ? 'w-10 h-9 justify-center' : 'h-9 px-3',
        active ? '' : 'hover:bg-bg-subtle hover:text-text-primary',
      ].join(' ')}
    >
      <Icon size={16} strokeWidth={1.5} className="shrink-0" />
      {!collapsed && (
        <>
          <span className="text-body flex-1" style={{ fontSize: 13.5 }}>{label}</span>
          {(guide || beta) && (
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase',
              color: '#9A9A9F', border: '1px solid rgba(255,255,255,0.14)',
              padding: '3px 7px', lineHeight: 1, flexShrink: 0,
            }}>
              beta
            </span>
          )}
        </>
      )}
    </Link>
  )

  if (!collapsed) return inner

  return (
    <Tooltip>
      <TooltipTrigger asChild>{inner}</TooltipTrigger>
      <TooltipContent
        side="right"
        sideOffset={8}
        className="bg-bg-elevated border border-border-default text-text-primary text-body-sm px-2.5 py-1.5 rounded-btn"
      >
        {label}
      </TooltipContent>
    </Tooltip>
  )
}
