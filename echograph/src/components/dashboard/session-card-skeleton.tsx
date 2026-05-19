export function SessionCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4 rounded-card border border-border-default bg-bg-elevated">
      {/* Row 1 — status + date */}
      <div className="flex items-center justify-between">
        <div className="h-4 w-20 rounded-full bg-bg-subtle animate-pulse" />
        <div className="h-3 w-12 rounded bg-bg-subtle animate-pulse" />
      </div>

      {/* Row 2 — title */}
      <div className="h-4 w-3/4 rounded bg-bg-subtle animate-pulse" />

      {/* Row 3 — input badges */}
      <div className="flex items-center gap-1.5">
        <div className="h-5 w-14 rounded-full bg-bg-subtle animate-pulse" />
        <div className="h-5 w-14 rounded-full bg-bg-subtle animate-pulse" />
      </div>
    </div>
  )
}
