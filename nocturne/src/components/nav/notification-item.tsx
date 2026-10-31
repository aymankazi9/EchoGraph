'use client'

import { X } from 'lucide-react'
import { motion } from 'framer-motion'
import { useNotificationStore, type Notification } from '@/store/notification-store'
import { notifEntry } from '@/lib/motion'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

// Destructive alone is crimson (THEME_SURGICAL.md §1.5); everything else is a neutral
// brightness step rather than a second hue.
const TYPE_STYLES: Record<Notification['type'], { dot: string; bg: string }> = {
  success: { dot: '#EDEDED', bg: 'rgba(255,255,255,0.05)' },
  error:   { dot: 'var(--color-severity)', bg: 'rgba(255,59,48,0.08)' },
  info:    { dot: '#9A9A9F', bg: 'rgba(255,255,255,0.03)' },
  warning: { dot: '#EDEDED', bg: 'rgba(255,255,255,0.03)' },
}

interface Props {
  notification: Notification
  collapsed: boolean
}

export function NotificationItem({ notification, collapsed }: Props) {
  const dismiss = useNotificationStore((s) => s.dismiss)
  const { dot, bg } = TYPE_STYLES[notification.type]

  const progressBar = !notification.persistent && (
    <motion.div
      className="absolute bottom-0 left-0 right-0 h-px opacity-40"
      style={{ scaleX: 1, originX: 0, background: dot }}
      animate={{ scaleX: 0 }}
      transition={{ duration: (notification.duration ?? 3000) / 1000, ease: 'linear' }}
    />
  )

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center justify-center py-2 relative overflow-hidden cursor-default" style={{ background: bg }}>
            <span className="w-1.5 h-1.5 shrink-0" style={{ background: dot }} />
            {progressBar}
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          className="bg-bg-elevated border border-border-default text-text-primary text-body-sm"
        >
          {notification.message}
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <motion.div
      variants={notifEntry}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout
      className="relative overflow-hidden group/notif"
      style={{ background: bg }}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="w-1.5 h-1.5 shrink-0" style={{ background: dot }} />
        <span className="text-body-sm text-text-primary flex-1 min-w-0 truncate">
          {notification.message}
        </span>
        <button
          type="button"
          onClick={() => dismiss(notification.id)}
          className="opacity-0 group-hover/notif:opacity-100 transition-opacity text-text-tertiary hover:text-text-primary shrink-0"
          aria-label="Dismiss notification"
        >
          <X size={14} strokeWidth={1.5} />
        </button>
      </div>
      {progressBar}
    </motion.div>
  )
}
