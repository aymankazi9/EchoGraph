import type { Metadata } from 'next'
import { StubPage } from '@/components/marketing/stub-page'

export const metadata: Metadata = {
  title: 'Accessibility — Nocturne',
  description: 'Nocturne is built with keyboard navigation, ARIA labels, and focus management throughout.',
  alternates: { canonical: '/accessibility' },
  openGraph: {
    title: 'Accessibility — Nocturne',
    description: 'Nocturne is built with keyboard navigation, ARIA labels, and focus management throughout.',
    url: 'https://appnocturne.com/accessibility',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Accessibility — Nocturne',
    description: 'Nocturne is built with keyboard navigation, ARIA labels, and focus management throughout.',
  },
}

export default function AccessibilityPage() {
  return (
    <StubPage
      badge="wip"
      title="Accessibility"
      description="Nocturne is built with keyboard navigation, ARIA labels, and focus management throughout. A formal accessibility statement is coming soon."
    />
  )
}
