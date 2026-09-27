import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Force dynamic rendering — cookie reads must run at request time, never from cache
export const dynamic = 'force-dynamic'

// Supabase's EmailOtpType — inlined to avoid coupling to @supabase/auth-js internals.
type EmailOtpType = 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change' | 'email'
const EMAIL_OTP_TYPES: EmailOtpType[] = [
  'signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email',
]

export async function GET(request: NextRequest) {
  // ── Params ──────────────────────────────────────────────────────────────────
  // Magic-link flow:   ?token_hash=…&type=magiclink  (verifyOtp)
  // OAuth PKCE flow:   ?code=…                       (exchangeCodeForSession)
  // Both may carry:    &next=/some/path              (post-auth destination)
  const tokenHash = request.nextUrl.searchParams.get('token_hash')
  const otpType   = request.nextUrl.searchParams.get('type')
  const code      = request.nextUrl.searchParams.get('code')
  const nextParam = request.nextUrl.searchParams.get('next') ?? ''
  const safeNext  = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : ''
  const origin    = request.nextUrl.origin

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll may throw in certain Next.js rendering contexts — safe to ignore here
          }
        },
      },
    }
  )

  if (tokenHash && otpType) {
    // ── Magic-link / email OTP ──────────────────────────────────────────────
    // otpType arrives from the URL; whitelist it before passing to verifyOtp
    // so a crafted URL can't trigger unexpected auth flows.
    if (!EMAIL_OTP_TYPES.includes(otpType as EmailOtpType)) {
      return NextResponse.redirect(new URL('/login?error=auth_failed', origin))
    }

    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType as EmailOtpType,
    })

    if (verifyError) {
      console.error('[callback] magic link verify error:', verifyError.message)
      // Both "expired" and "already used" tokens return a generic OTP error —
      // surface them under a single user-facing code.
      return NextResponse.redirect(new URL('/login?error=link_expired', origin))
    }
  } else if (code) {
    // ── OAuth PKCE code-exchange ────────────────────────────────────────────
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      console.error('[callback] auth exchange error:', exchangeError.message)
      // pkce_code_verifier_not_found: the verifier cookie was gone by the time
      // the callback ran (tab refreshed, second OAuth attempt overwrote it, etc.).
      const errorCode =
        exchangeError.code === 'pkce_code_verifier_not_found'
          ? 'session_expired'
          : 'auth_failed'
      return NextResponse.redirect(new URL(`/login?error=${errorCode}`, origin))
    }
  } else {
    // Neither flow — no usable params in the URL.
    return NextResponse.redirect(new URL('/login?error=missing_code', origin))
  }

  // ── Common post-auth routing ────────────────────────────────────────────────
  // Shared by both OAuth and magic-link — do not duplicate.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', origin))
  }

  const { data: profile } = await supabase
    .from('users')
    .select('pbkdf2_salt')
    .eq('id', user.id)
    .single()

  // If a post-auth destination was requested (e.g. /checkout?tier=midnight),
  // go there directly.  Checkout doesn't require vault access, so we can skip
  // the unlock/setup step; those pages will redirect back if the vault is
  // needed later.  For all other destinations, preserve the normal flow.
  const destination = safeNext || (profile?.pbkdf2_salt ? '/unlock' : '/setup')
  return NextResponse.redirect(new URL(destination, origin))
}
