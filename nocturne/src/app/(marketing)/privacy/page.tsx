import type { Metadata } from 'next'
import { StubPage } from '@/components/marketing/stub-page'

export const metadata: Metadata = {
  title: 'Privacy Policy — Nocturne',
}

export default function PrivacyPage() {
  return (
    <StubPage
      badge="beta"
      title="Privacy Policy"
      description="A full privacy policy is being drafted for launch. In the meantime, see our Security page for how we handle your data."
    />
  )
}
