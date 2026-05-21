import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle, AlertTriangle, Info } from 'lucide-react'
import { PageFade } from '@/components/marketing/page-fade'

export const metadata: Metadata = {
  title: 'Confirm subscription — Nocturne',
}

type ConfirmResult =
  | { status: 'confirmed'; email: string }
  | { status: 'already_confirmed'; email: string }
  | { status: 'error' }

async function confirmToken(token: string): Promise<ConfirmResult> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/confirm-newsletter`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ token }),
        cache: 'no-store',
      },
    )
    if (!res.ok) return { status: 'error' }
    const data = await res.json()
    if (data.status === 'confirmed') return { status: 'confirmed', email: data.email }
    if (data.status === 'already_confirmed') return { status: 'already_confirmed', email: data.email }
    return { status: 'error' }
  } catch {
    return { status: 'error' }
  }
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 py-20 text-center max-w-[480px] mx-auto">
      {children}
    </div>
  )
}

export default async function ConfirmSubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  if (!token) {
    return (
      <PageFade>
        <Centered>
          <AlertTriangle size={40} strokeWidth={1.25} className="text-rose-300 mb-5" />
          <h1 className="text-subheading font-medium text-text-primary mb-3">
            Link expired or invalid.
          </h1>
          <p className="text-body-sm text-text-secondary mb-8">
            This confirmation link has expired or has already been used.
            Subscribe again to get a new link.
          </p>
          <Link
            href="/#newsletter"
            className="inline-flex h-9 px-5 items-center rounded-btn text-body-sm font-medium bg-indigo-500 text-text-inverse hover:bg-indigo-600 transition-colors"
          >
            Subscribe again
          </Link>
        </Centered>
      </PageFade>
    )
  }

  const result = await confirmToken(token)

  if (result.status === 'confirmed') {
    return (
      <PageFade>
        <Centered>
          <CheckCircle size={40} strokeWidth={1.25} className="text-indigo-400 mb-5" />
          <h1 className="text-subheading font-medium text-text-primary mb-3">
            You&apos;re subscribed.
          </h1>
          <p className="text-body-sm text-text-secondary mb-8">
            Thanks for confirming. We&apos;ll send updates on new features, beta releases,
            and study tips for STEM students directly to{' '}
            <span className="text-text-primary">{result.email}</span>.
          </p>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex h-9 px-5 items-center rounded-btn text-body-sm font-medium bg-indigo-500 text-text-inverse hover:bg-indigo-600 transition-colors"
            >
              Go to Nocturne
            </Link>
            <Link
              href="/security"
              className="inline-flex h-9 px-4 items-center rounded-btn text-body-sm text-text-secondary border border-border-default hover:bg-bg-subtle transition-colors"
            >
              Learn about security
            </Link>
          </div>
        </Centered>
      </PageFade>
    )
  }

  if (result.status === 'already_confirmed') {
    return (
      <PageFade>
        <Centered>
          <Info size={40} strokeWidth={1.25} className="text-text-secondary mb-5" />
          <h1 className="text-subheading font-medium text-text-primary mb-3">
            Already confirmed.
          </h1>
          <p className="text-body-sm text-text-secondary mb-8">
            This email is already subscribed to Nocturne updates.
          </p>
          <Link
            href="/"
            className="inline-flex h-9 px-4 items-center rounded-btn text-body-sm text-text-secondary border border-border-default hover:bg-bg-subtle transition-colors"
          >
            Back to home
          </Link>
        </Centered>
      </PageFade>
    )
  }

  // Error / expired token
  return (
    <PageFade>
      <Centered>
        <AlertTriangle size={40} strokeWidth={1.25} className="text-rose-300 mb-5" />
        <h1 className="text-subheading font-medium text-text-primary mb-3">
          Link expired or invalid.
        </h1>
        <p className="text-body-sm text-text-secondary mb-8">
          This confirmation link has expired or has already been used.
          Subscribe again to get a new link.
        </p>
        <Link
          href="/#newsletter"
          className="inline-flex h-9 px-5 items-center rounded-btn text-body-sm font-medium bg-indigo-500 text-text-inverse hover:bg-indigo-600 transition-colors"
        >
          Subscribe again
        </Link>
      </Centered>
    </PageFade>
  )
}
