'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { Download } from 'lucide-react'
import { useNotificationStore } from '@/store/notification-store'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const ALLOWED_PATHS = ['/', '/vault']
const DISMISSED_KEY = 'nocturne-install-dismissed'

interface Props {
  /** When true, reads localStorage nav state and offsets the banner left. */
  navOffset?: boolean
}

export function InstallBanner({ navOffset = false }: Props) {
  const pathname = usePathname()
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [leftOffset, setLeftOffset] = useState(0)

  useEffect(() => {
    // iOS Safari doesn't fire beforeinstallprompt — hide banner entirely on iOS
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(window as unknown as { MSStream?: unknown }).MSStream

    if (isIOS) return

    // Already running in standalone mode (already installed)
    if (window.matchMedia('(display-mode: standalone)').matches) return

    // Already dismissed this session
    if (sessionStorage.getItem(DISMISSED_KEY)) return

    // Resolve left offset for authenticated pages (nav width)
    if (navOffset) {
      const collapsed = localStorage.getItem('nocturne-nav-collapsed') === 'true'
      setLeftOffset(collapsed ? 48 : 220)
    }

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault()
      deferredPrompt.current = e as BeforeInstallPromptEvent
      setShowBanner(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  }, [navOffset])

  // Only render on allowed paths
  if (!ALLOWED_PATHS.includes(pathname)) return null

  async function handleInstall() {
    if (!deferredPrompt.current) return
    await deferredPrompt.current.prompt()
    const { outcome } = await deferredPrompt.current.userChoice
    deferredPrompt.current = null
    sessionStorage.setItem(DISMISSED_KEY, '1')
    setShowBanner(false)
    if (outcome === 'accepted') {
      useNotificationStore.getState().notify({
        type: 'success',
        message: 'Nocturne installed',
        duration: 3000,
      })
    }
  }

  function handleDismiss() {
    sessionStorage.setItem(DISMISSED_KEY, '1')
    setShowBanner(false)
  }

  if (!showBanner) return null

  return (
    <motion.div
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 60, opacity: 0, transition: { duration: 0.15, ease: 'easeIn' } }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="fixed bottom-0 right-0 z-50 flex items-center justify-between px-5 py-3 bg-bg-elevated border-t border-border-default"
      style={{ left: leftOffset }}
    >
      {/* Left: icon + copy */}
      <div className="flex items-center gap-2.5">
        <Download size={16} strokeWidth={1.5} className="text-indigo-400 shrink-0" />
        <span className="text-body-sm font-medium text-text-primary">Install Nocturne</span>
        <span className="text-caption text-text-secondary hidden sm:inline">
          Add to your desktop for quick access
        </span>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleInstall}
          className="h-8 px-3.5 rounded-btn text-[13px] font-medium bg-indigo-500 text-text-inverse hover:bg-indigo-600 transition-colors"
        >
          Install
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="h-8 px-3.5 rounded-btn text-[13px] text-text-secondary border border-border-default hover:bg-bg-subtle transition-colors"
        >
          Not now
        </button>
      </div>
    </motion.div>
  )
}
