import type { Metadata } from 'next'
import { LegalClient } from '../LegalClient'

export const metadata: Metadata = {
  title: 'Privacy Policy — Nocturne',
  description: 'How Nocturne collects, uses, and protects your information with zero-knowledge architecture.',
}

export default function PrivacyPage() {
  return <LegalClient initialDoc="privacy" />
}
