// Centered single-column layout for all vault flow screens.
// DESIGN_SYSTEM.md §9 — full-page centered, max-width 440px.
export default function VaultLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[440px]">{children}</div>
    </div>
  )
}
