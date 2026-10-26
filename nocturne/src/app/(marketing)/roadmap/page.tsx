import type { Metadata } from 'next'
import { StubPage } from '@/components/marketing/stub-page'

export const metadata: Metadata = {
  title: 'Roadmap — Nocturne',
  description: "What we're building next — Scholar tier, mobile apps, and more.",
  alternates: { canonical: '/roadmap' },
  openGraph: {
    title: 'Roadmap — Nocturne',
    description: "What we're building next — Scholar tier, mobile apps, and more.",
    url: 'https://appnocturne.com/roadmap',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Roadmap — Nocturne',
    description: "What we're building next — Scholar tier, mobile apps, and more.",
  },
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
