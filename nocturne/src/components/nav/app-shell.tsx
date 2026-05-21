'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isVaultUnlocked } from '@/lib/crypto/vault'
import { SideNav } from './side-nav'

interface Props {
  email: string
  usedBytes: number
  children: React.ReactNode
}

export function AppShell({ email, usedBytes, children }: Props) {
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
      <SideNav email={email} usedBytes={usedBytes} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
