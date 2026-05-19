'use client'

import { X } from 'lucide-react'
import { motion } from 'framer-motion'
import { useNotificationStore, type Notification } from '@/store/notification-store'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const TYPE_STYLES: Record<Notification['type'], { dot: string; bg: string }> = {
  success: { dot: 'bg-teal-300',     bg: 'bg-teal-500/10' },
  error:   { dot: 'bg-red-200',      bg: 'bg-red-500/10' },
  info:    { dot: 'bg-text-secondary', bg: 'bg-bg-subtle' },
  warning: { dot: 'bg-amber-200',    bg: 'bg-amber-500/10' },
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
      className={`absolute bottom-0 left-0 right-0 h-0.5 ${dot} opacity-40`}
      style={{ scaleX: 1, originX: 0 }}
      animate={{ scaleX: 0 }}
      transition={{ duration: (notification.duration ?? 3000) / 1000, ease: 'linear' }}
    />
  )

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center justify-center py-2 ${bg} relative overflow-hidden cursor-default`}>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
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
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0, transition: { duration: 0.15 } }}
      className={`relative overflow-hidden group/notif ${bg}`}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
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
