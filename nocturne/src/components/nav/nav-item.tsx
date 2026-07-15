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
}

export function NavItem({ href, icon: Icon, label, collapsed, beta }: Props) {
  const pathname = usePathname()
  const isActive = pathname === href || (href !== '/vault' && pathname.startsWith(href))

  const inner = (
    <Link
      href={href}
      data-navitem
      style={isActive ? { background: 'rgba(99,102,241,0.13)', color: '#C7CEF5' } : undefined}
      className={[
        'flex items-center gap-3 rounded-md transition-colors',
        collapsed ? 'w-10 h-[38px] justify-center' : 'h-[38px] px-3',
        isActive ? '' : 'text-text-secondary hover:bg-bg-subtle hover:text-text-primary',
      ].join(' ')}
    >
      <Icon size={16} strokeWidth={1.5} className="shrink-0" />
      {!collapsed && (
        <>
          <span className="text-body flex-1">{label}</span>
          {beta && (
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
