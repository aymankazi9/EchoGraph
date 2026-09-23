'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isVaultUnlocked } from '@/lib/crypto/vault'
import type { Tier } from '@/lib/tiers/features'
import { SideNav } from './side-nav'

interface Props {
  email: string
  usedBytes: number
  tier: Tier
  /** True when subscriptions.status === 'past_due'. Renders a payment banner. */
  pastDue?: boolean
  children: React.ReactNode
}

export function AppShell({ email, usedBytes, tier, pastDue = false, children }: Props) {
  const [vaultReady, setVaultReady] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (!isVaultUnlocked()) {
      router.replace('/unlock')
    } else {
      setVaultReady(true)
    }
  }, [router])

  if (!vaultReady) {
    // Blank screen while checking — redirect happens immediately
    return <div className="h-screen bg-bg-base" />
  }

  return (
    <div className="h-screen flex overflow-hidden bg-bg-base">
      <SideNav email={email} usedBytes={usedBytes} tier={tier} />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {pastDue && (
          <div style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '9px 20px',
            background: 'rgba(251,191,36,0.07)',
            borderBottom: '1px solid rgba(251,191,36,0.18)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FCD34D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span style={{ fontSize: 13, color: '#FCD34D' }}>
                Your last payment failed — update your payment method to keep your plan.
              </span>
            </div>
            <a
              href="/billing"
              style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 500, color: '#FCD34D', textDecoration: 'underline', textUnderlineOffset: 3 }}
            >
              Manage billing →
            </a>
          </div>
        )}
        <main className="flex-1 min-w-0 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  )
}
