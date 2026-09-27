import { IS_BETA_MODE } from '@/lib/beta'
import { notFound } from 'next/navigation'
import { BetaGuideContent } from '@/components/beta-guide/beta-guide-content'

export const metadata = { title: 'Beta Guide — Nocturne' }

export default function BetaGuidePage() {
  // This page is only meaningful during beta — redirect to 404 once beta ends.
  if (!IS_BETA_MODE) notFound()

  return <BetaGuideContent />
}
