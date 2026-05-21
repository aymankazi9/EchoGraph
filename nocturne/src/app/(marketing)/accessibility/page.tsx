import type { Metadata } from 'next'
import { StubPage } from '@/components/marketing/stub-page'

export const metadata: Metadata = {
  title: 'Accessibility — Nocturne',
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
