import type { Metadata } from 'next'
import { StubPage } from '@/components/marketing/stub-page'

export const metadata: Metadata = {
  title: 'Accessibility — EchoGraph',
}

export default function AccessibilityPage() {
  return (
    <StubPage
      badge="wip"
      title="Accessibility"
      description="EchoGraph is built with keyboard navigation, ARIA labels, and focus management throughout. A formal accessibility statement is coming soon."
    />
  )
}
