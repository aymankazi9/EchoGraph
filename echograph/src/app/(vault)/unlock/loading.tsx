export default function UnlockLoading() {
  return (
    <div className="flex flex-col gap-8 animate-pulse">
      {/* Icon + heading */}
      <div className="flex flex-col gap-3">
        <div className="h-8 w-8 rounded-md bg-bg-subtle" />
        <div className="flex flex-col gap-1.5">
          <div className="h-7 w-52 rounded-md bg-bg-subtle" />
          <div className="h-4 w-full rounded-md bg-bg-subtle" />
          <div className="h-4 w-3/4 rounded-md bg-bg-subtle" />
        </div>
      </div>

      {/* Input + button */}
      <div className="flex flex-col gap-5">
        <div className="h-9 w-full rounded-md bg-bg-subtle" />
        <div className="h-9 w-full rounded-btn bg-bg-subtle" />
      </div>
    </div>
  )
}
