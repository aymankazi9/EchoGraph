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
   * When true, renders with an amber accent instead of the standard indigo —
   * used exclusively for the Beta Guide nav item to visually signal that it's
   * an informational page, not a primary workspace destination.
   */
  guide?: boolean
}

export function NavItem({ href, icon: Icon, label, collapsed, beta, guide }: Props) {
  const pathname = usePathname()
  const isActive = pathname === href || (href !== '/vault' && pathname.startsWith(href))

  // Amber treatment for the Beta Guide item — active or inactive both use amber,
  // so it never reads as a regular workspace tab.
  const guideStyle = guide
    ? isActive
      ? { background: 'rgba(245,158,11,0.14)', color: '#FCD34D' }
      : { background: 'rgba(245,158,11,0.06)', color: '#D4A017' }
    : undefined

  const inner = (
    <Link
      href={href}
      data-navitem
      style={
        guideStyle ??
        (isActive ? { background: 'rgba(99,102,241,0.13)', color: '#C7CEF5' } : undefined)
      }
      className={[
        'flex items-center gap-3 rounded-md transition-colors',
        collapsed ? 'w-10 h-[38px] justify-center' : 'h-[38px] px-3',
        // Guide items always have a tint; regular items only show on hover/active.
        guide
          ? ''
          : isActive
          ? ''
          : 'text-text-secondary hover:bg-bg-subtle hover:text-text-primary',
      ].join(' ')}
    >
      <Icon size={16} strokeWidth={1.5} className="shrink-0" />
      {!collapsed && (
        <>
          <span className="text-body flex-1">{label}</span>
          {guide && (
            <span style={{
              fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
              color: '#D4A017', background: 'rgba(245,158,11,0.10)',
              border: '1px solid rgba(245,158,11,0.20)',
              borderRadius: 4, padding: '1px 5px', lineHeight: 1, flexShrink: 0,
            }}>
              beta
            </span>
          )}
          {!guide && beta && (
            <span style={{
              fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
              color: '#818CF8', background: 'rgba(99,102,241,0.12)',
              border: '1px solid rgba(99,102,241,0.25)',
              borderRadius: 4, padding: '1px 5px', lineHeight: 1, flexShrink: 0,
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
