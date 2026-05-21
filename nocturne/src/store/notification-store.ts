import { create } from 'zustand'

export type NotificationType = 'success' | 'error' | 'info' | 'warning'

export interface Notification {
  id: string
  type: NotificationType
  message: string
  duration?: number
  persistent?: boolean
}

interface NotificationStore {
  notifications: Notification[]
  notify(n: Omit<Notification, 'id'>): void
  dismiss(id: string): void
  dismissAll(): void
}

// Module-level map — not in Zustand state since timers aren't serializable.
const timers = new Map<string, ReturnType<typeof setTimeout>>()

export const useNotificationStore = create<NotificationStore>()((set, get) => ({
  notifications: [],

  notify: ({ type, message, duration = 3000, persistent = false }) => {
    const id = crypto.randomUUID()
    const notification: Notification = { id, type, message, duration, persistent }

    let next = [...get().notifications]

    // Cap at 3: dismiss the oldest non-persistent one before adding.
    if (next.length >= 3) {
      const oldestIdx = next.findIndex((n) => !n.persistent)
      if (oldestIdx !== -1) {
        const oldest = next[oldestIdx]!
        clearTimeout(timers.get(oldest.id))
        timers.delete(oldest.id)
        next.splice(oldestIdx, 1)
      }
    }

    set({ notifications: [...next, notification] })

    if (!persistent) {
      const timer = setTimeout(() => get().dismiss(id), duration)
      timers.set(id, timer)
    }
  },

  dismiss: (id) => {
    clearTimeout(timers.get(id))
    timers.delete(id)
    set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) }))
  },

  dismissAll: () => {
    timers.forEach((t) => clearTimeout(t))
    timers.clear()
    set({ notifications: [] })
  },
}))
