import type { Metadata } from 'next'
import { StubPage } from '@/components/marketing/stub-page'

export const metadata: Metadata = {
  title: 'Roadmap — EchoGraph',
}

export default function RoadmapPage() {
  return (
    <StubPage
      badge="soon"
      title="What we're building next"
      description="Scholar tier, Pro tier, mobile apps, and more. A public roadmap is coming once the beta stabilizes."
    />
  )
}
