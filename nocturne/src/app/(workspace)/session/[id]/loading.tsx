export default function SessionLoading() {
  return (
    <div className="flex h-screen bg-bg-base animate-pulse">
      {/* Audio / controls strip — 20% */}
      <div className="w-[20%] border-r border-border-subtle flex flex-col gap-4 p-4">
        <div className="h-5 w-3/4 rounded-md bg-bg-subtle" />
        <div className="h-2 w-full rounded-full bg-bg-subtle" />
        <div className="flex gap-2">
          <div className="h-8 w-8 rounded-full bg-bg-subtle" />
          <div className="h-8 w-8 rounded-full bg-bg-subtle" />
          <div className="h-8 w-8 rounded-full bg-bg-subtle" />
        </div>
        <div className="flex flex-col gap-2 mt-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-4 rounded-md bg-bg-subtle" style={{ width: `${60 + (i % 3) * 15}%` }} />
          ))}
        </div>
      </div>

      {/* Transcript — 45% */}
      <div className="w-[45%] border-r border-border-subtle p-6 flex flex-col gap-3">
        <div className="h-5 w-32 rounded-md bg-bg-subtle mb-2" />
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-4 rounded-md bg-bg-subtle" style={{ width: `${50 + (i % 5) * 10}%` }} />
        ))}
      </div>

      {/* PDF viewer — 35% */}
      <div className="flex-1 p-4 flex flex-col gap-3">
        <div className="h-5 w-24 rounded-md bg-bg-subtle mb-2" />
        <div className="flex-1 rounded-card bg-bg-subtle" />
      </div>
    </div>
  )
}
