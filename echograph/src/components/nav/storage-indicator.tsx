interface Props {
  usedBytes: number
  maxBytes: number
}

function formatMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(0)
}

export function StorageIndicator({ usedBytes, maxBytes }: Props) {
  const pct = Math.min((usedBytes / maxBytes) * 100, 100)

  return (
    <div className="flex flex-col gap-1.5 px-2">
      <div className="flex items-center justify-between">
        <span className="text-caption uppercase tracking-[0.07em] text-text-tertiary">
          Vault storage
        </span>
      </div>
      <div className="h-1 w-full rounded-full bg-bg-subtle overflow-hidden">
        <div
          className="h-full rounded-full bg-teal-300 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-caption text-text-tertiary">
        {formatMB(usedBytes)} MB of {formatMB(maxBytes)} MB
      </span>
    </div>
  )
}
