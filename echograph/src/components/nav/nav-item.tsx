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
}

export function NavItem({ href, icon: Icon, label, collapsed }: Props) {
  const pathname = usePathname()
  const isActive = pathname === href || (href !== '/vault' && pathname.startsWith(href))

  const inner = (
    <Link
      href={href}
      className={[
        'flex items-center gap-3 rounded-btn transition-colors',
        collapsed ? 'w-8 h-8 justify-center' : 'h-9 px-3',
        isActive
          ? 'bg-bg-subtle text-text-primary border-l-2 border-teal-300 pl-[10px]'
          : 'text-text-secondary hover:bg-bg-subtle hover:text-text-primary border-l-2 border-transparent',
        !isActive && !collapsed ? 'pl-[10px]' : '',
      ].join(' ')}
    >
      <Icon size={16} strokeWidth={1.5} className="shrink-0" />
      {!collapsed && <span className="text-body">{label}</span>}
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
