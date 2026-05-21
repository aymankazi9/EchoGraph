export default function SettingsLoading() {
  return (
    <div className="p-8 max-w-2xl mx-auto flex flex-col gap-8 animate-pulse">
      {/* Page header */}
      <div className="h-7 w-28 rounded-md bg-bg-subtle" />

      {/* Section blocks */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-4">
          <div className="h-4 w-32 rounded-md bg-bg-subtle" />
          <div className="flex flex-col gap-3">
            <div className="h-9 w-full rounded-md bg-bg-subtle" />
            <div className="h-9 w-full rounded-md bg-bg-subtle" />
          </div>
        </div>
      ))}
    </div>
  )
}
