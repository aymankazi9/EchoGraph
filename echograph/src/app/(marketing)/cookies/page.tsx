import type { Metadata } from 'next'
import { StubPage } from '@/components/marketing/stub-page'

export const metadata: Metadata = {
  title: 'Cookie Policy — EchoGraph',
}

export default function CookiesPage() {
  return (
    <StubPage
      badge="beta"
      title="Cookie Policy"
      description="EchoGraph uses minimal cookies — only what's required for authentication and vault state. A full cookie policy is coming before public launch."
    />
  )
}
