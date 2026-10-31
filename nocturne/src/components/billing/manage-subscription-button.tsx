'use client'

import { useState } from 'react'

// Beta mode: billing portal is not available — button renders nothing.
const IS_BETA = process.env.NEXT_PUBLIC_BETA_MODE === 'true'

interface Props {
  /** When true, the button is shown as a secondary outline style.
   *  When false (default), it uses the primary indigo style. */
  secondary?: boolean
}

export function ManageSubscriptionButton({ secondary = false }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Beta: portal not available yet.
  if (IS_BETA) return null

  async function handleClick() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError((body as { error?: string }).error ?? 'Something went wrong')
        return
      }
      const { url } = await res.json() as { url: string }
      window.location.href = url
    } catch {
      setError('Could not reach billing portal')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          height: 36,
          padding: '0 18px',
          fontSize: 13.5,
          fontWeight: 500,
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.65 : 1,
          background: secondary ? 'transparent' : 'var(--color-accent)',
          color: secondary ? '#9A9A9F' : 'var(--color-text-inverse)',
          border: secondary ? '1px solid rgba(255,255,255,0.16)' : 'none',
          transition: 'opacity .15s, background .15s',
        }}
      >
        {loading ? 'Opening portal…' : 'Manage subscription'}
      </button>
      {error && (
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-severity)', margin: '8px 0 0' }}>{error}</p>
      )}
    </div>
  )
}
