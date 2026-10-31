'use client'

import { ErrorPage } from '@/components/surgical/error-page'

export default function MarketingError({
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
      headline="Something went wrong"
      body="A server-side error interrupted this page. Nothing was lost — try reloading or head back home."
      primary={{ label: 'Reload page', onClick: reset }}
      secondary={{ label: 'Back to home', href: '/' }}
      terminal={terminal}
    />
  )
}
