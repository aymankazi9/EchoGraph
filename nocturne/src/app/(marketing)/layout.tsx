import { NavBar } from '@/components/marketing/nav-bar'
import { LandingFooter } from '@/components/landing/landing-footer'
import { RevealSetup } from '@/components/marketing/reveal-setup'

// Marketing shell — no vault nav, no auth required.
// overflow-x-hidden prevents any component from causing horizontal scroll.
// pt-[60px] compensates for the fixed nav (60px tall).
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg-base overflow-x-hidden">
      <RevealSetup />
      <NavBar />
      <main className="pt-[60px]">{children}</main>
      <LandingFooter />
    </div>
  )
}
