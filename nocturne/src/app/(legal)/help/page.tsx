import type { Metadata } from 'next'
import { HelpClient } from '../HelpClient'

export const metadata: Metadata = {
  title: 'Help Center — Nocturne',
  description: 'Search documentation, browse FAQs, or submit a support ticket. Our team replies within one business day.',
}

export default function HelpPage() {
  return <HelpClient />
}
