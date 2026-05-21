// Full-screen layout for the study workspace — no centered max-width constraint.
// Intentionally separate from (vault) layout which centers narrow auth flows.
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-bg-base">
      {children}
    </div>
  )
}
