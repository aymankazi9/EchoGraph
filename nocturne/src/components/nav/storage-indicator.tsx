import { formatBytes } from '@/lib/format'

interface Props {
  usedBytes: number
  maxBytes: number
}

export function StorageIndicator({ usedBytes, maxBytes }: Props) {
  const pct = Math.min((usedBytes / maxBytes) * 100, 100)

  return (
    <div className="flex flex-col gap-1.5 px-2">
      <div className="flex items-center justify-between">
        <span className="text-caption uppercase" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.07em', color: '#76767B' }}>
          Vault storage
        </span>
      </div>
      <div className="h-px w-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${pct}%`, background: 'var(--color-accent)' }}
        />
      </div>
      <span className="text-caption" style={{ fontFamily: 'var(--font-mono)', color: '#76767B' }}>
        {formatBytes(usedBytes)} of {formatBytes(maxBytes)}
      </span>
    </div>
  )
}
