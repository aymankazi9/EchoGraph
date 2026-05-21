'use client'

import { AnimatePresence } from 'framer-motion'
import { useNotificationStore } from '@/store/notification-store'
import { NotificationItem } from './notification-item'

interface Props {
  collapsed: boolean
}

export function NotificationStrip({ collapsed }: Props) {
  const notifications = useNotificationStore((s) => s.notifications)

  if (notifications.length === 0) return null

  return (
    <div className="flex flex-col overflow-hidden">
      <AnimatePresence mode="sync">
        {notifications.map((n) => (
          <NotificationItem key={n.id} notification={n} collapsed={collapsed} />
        ))}
      </AnimatePresence>
    </div>
  )
}
