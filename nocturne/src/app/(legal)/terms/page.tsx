import type { Metadata } from 'next'
import { LegalClient } from '../LegalClient'

export const metadata: Metadata = {
  title: 'Terms of Service — Nocturne',
  description: 'The agreement that governs your use of Nocturne.',
}

export default function TermsPage() {
  return <LegalClient initialDoc="terms" />
}
