'use client'

import { useState } from 'react'
import { Shield } from 'lucide-react'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)

  async function handleGoogleSignIn() {
    setLoading(true)
    const supabase = createClient()

    // debug line added - temporary
    // console.log('redirectTo:', `${window.location.origin}/auth/callback`)

    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    // Browser redirects — no need to setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-[440px] flex flex-col gap-10">
        {/* Brand */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Shield size={24} strokeWidth={1.5} className="text-indigo-400" />
            <span className="text-heading font-medium text-text-primary">Nocturne</span>
          </div>
          <p className="text-body text-text-secondary">
            Not a note-taker. A study intelligence system.
          </p>
        </div>

        {/* Sign in */}
        <div className="flex flex-col gap-4">
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className={[
              'h-9 px-4 rounded-btn text-body font-medium flex items-center justify-center gap-2',
              'border border-border-default transition-colors',
              loading
                ? 'text-text-tertiary cursor-not-allowed'
                : 'text-text-primary hover:bg-bg-subtle',
            ].join(' ')}
          >
            {/* Google G mark */}
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {loading ? 'Redirecting…' : 'Continue with Google'}
          </button>

          <p className="text-body-sm text-text-tertiary text-center">
            Your passphrase and encryption keys never leave your device.
          </p>
        </div>
      </div>
    </div>
  )
}
