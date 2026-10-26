import type { Metadata } from 'next'
import { LegalClient } from '../LegalClient'

export const metadata: Metadata = {
  title: 'Security — Nocturne',
  description: "A technical account of Nocturne's zero-knowledge architecture — what protects your data and what we can never see.",
  alternates: { canonical: '/security' },
  openGraph: {
    title: 'Security — Nocturne',
    description: "A technical account of Nocturne's zero-knowledge architecture — what protects your data and what we can never see.",
    url: 'https://appnocturne.com/security',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Security — Nocturne',
    description: "A technical account of Nocturne's zero-knowledge architecture — what protects your data and what we can never see.",
  },
}

export default function SecurityPage() {
  return <LegalClient initialDoc="security" />
}
