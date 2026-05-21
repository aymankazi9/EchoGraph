import { NavBar } from '@/components/marketing/nav-bar'
import { Footer } from '@/components/marketing/footer'

// Marketing shell — no vault nav, no auth required.
// overflow-x-hidden prevents any component from causing horizontal scroll.
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg-base overflow-x-hidden">
      <NavBar />
      <main>{children}</main>
      <Footer />
    </div>
  )
}
