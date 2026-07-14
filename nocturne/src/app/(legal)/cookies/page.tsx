import type { Metadata } from 'next'
import { LegalClient } from '../LegalClient'

export const metadata: Metadata = {
  title: 'Cookie Policy — Nocturne',
  description: 'The minimal set of cookies Nocturne uses — only what is required for authentication and vault state.',
}

export default function CookiesPage() {
  return <LegalClient initialDoc="cookies" />
}
