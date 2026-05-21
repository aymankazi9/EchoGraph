'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getMasterKey } from '@/lib/crypto/vault'
import { decryptText } from '@/lib/crypto/decrypt'
import Link from 'next/link'

const TIER_LIMITS: Record<string, number> = {
  free: 500,
  scholar: 5120,
  pro: 20480,
}

interface SessionBreakdown {
  id: string
  title_encrypted: string | null
  total_mb: number
}

interface Props {
  usedBytes: number
  tier: string | null
  sessionBreakdown: SessionBreakdown[]
}

function storageBarColor(pct: number): string {
  if (pct >= 90) return 'bg-red-200'
  if (pct >= 70) return 'bg-amber-200'
  return 'bg-indigo-500'
}

export function StorageSection({ usedBytes, tier, sessionBreakdown }: Props) {
  const router = useRouter()
  const limitMB = TIER_LIMITS[tier ?? 'free'] ?? 500
  const usedMB = usedBytes / (1024 * 1024)
  const pct = Math.min((usedMB / limitMB) * 100, 100)

  const [titles, setTitles] = useState<Record<string, string>>({})

  useEffect(() => {
    const mk = getMasterKey()
    if (!mk) return
    Promise.all(
      sessionBreakdown.map(async (s) => {
        if (!s.title_encrypted) return [s.id, null] as const
        try {
          return [s.id, await decryptText(mk, s.title_encrypted)] as const
        } catch {
          return [s.id, null] as const
        }
      }),
    ).then((entries) => {
      const filtered = entries.filter((e): e is [string, string] => e[1] !== null)
      setTitles(Object.fromEntries(filtered))
    })
  }, [sessionBreakdown])

  return (
    <div>
      <p className="text-caption uppercase tracking-[0.07em] text-text-tertiary mb-4">
        Vault storage
      </p>

      {/* Storage bar */}
      <div className="flex flex-col gap-2 py-3 border-b border-border-subtle">
        <div className="flex items-center justify-between">
          <span className="text-body-sm text-text-secondary">Storage used</span>
          <span className="text-body-sm text-text-primary tabular-nums">
            {usedMB.toFixed(1)} MB of {limitMB} MB
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-bg-subtle overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${storageBarColor(pct)}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-caption text-text-tertiary">
          Encrypted files only. Metadata is not counted.
        </p>
      </div>

      {/* Session breakdown */}
      {sessionBreakdown.length > 0 && (
        <div className="py-3">
          <p className="text-body-sm font-medium text-text-primary mb-3">Sessions</p>
          <div className="flex flex-col gap-0">
            {sessionBreakdown.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => router.push(`/session/${s.id}`)}
                className="flex items-center justify-between py-2 hover:opacity-70 transition-opacity text-left"
              >
                <span className="text-body-sm text-text-primary truncate flex-1 min-w-0 pr-4">
                  {titles[s.id] ?? 'Untitled session'}
                </span>
                <span className="text-caption text-text-tertiary shrink-0">
                  {s.total_mb.toFixed(1)} MB
                </span>
              </button>
            ))}
          </div>
          {sessionBreakdown.length >= 5 && (
            <Link
              href="/vault"
              className="text-caption text-indigo-400 hover:text-indigo-300 transition-colors mt-2 inline-block"
            >
              View all in vault →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
