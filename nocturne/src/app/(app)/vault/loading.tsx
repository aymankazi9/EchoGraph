export default function VaultLoading() {
  return (
    <div className="p-8 max-w-5xl mx-auto flex flex-col gap-8 animate-pulse">
      {/* Page header */}
      <div className="flex flex-col gap-2">
        <div className="h-7 w-40 rounded-md bg-bg-subtle" />
        <div className="h-4 w-64 rounded-md bg-bg-subtle" />
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-card border border-border-subtle p-5 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="h-5 flex-1 rounded-md bg-bg-subtle" />
              <div className="h-4 w-16 rounded-md bg-bg-subtle shrink-0" />
            </div>
            <div className="h-3 w-3/4 rounded-md bg-bg-subtle" />
            <div className="flex gap-2 mt-1">
              <div className="h-5 w-20 rounded-full bg-bg-subtle" />
              <div className="h-5 w-16 rounded-full bg-bg-subtle" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
