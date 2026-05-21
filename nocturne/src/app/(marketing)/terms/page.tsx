import type { Metadata } from 'next'
import { StubPage } from '@/components/marketing/stub-page'

export const metadata: Metadata = {
  title: 'Terms of Service — Nocturne',
}

export default function TermsPage() {
  return (
    <StubPage
      badge="beta"
      title="Terms of Service"
      description="Terms of Service are being drafted for our general launch. Nocturne is currently in private beta."
    />
  )
}
