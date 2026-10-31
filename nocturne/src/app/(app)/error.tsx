'use client'

import { ErrorPage } from '@/components/surgical/error-page'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const terminal = [
    { src: 'sys', msg: 'request failed', value: error.digest ?? 'no digest' },
    ...(process.env.NODE_ENV === 'development' ? [{ src: 'dev', msg: 'message', value: error.message }] : []),
  ]

  return (
    <ErrorPage
      code="500"
      severity
      compact
      headline="Something jammed on our end"
      body="A server hit a fault while reaching for your vault. Nothing was lost and nothing was decrypted — your data remains locked and intact."
      primary={{ label: 'Try again', onClick: reset }}
      secondary={{ label: 'Visit Help Center', href: '/help' }}
      terminal={terminal}
    />
  )
}
