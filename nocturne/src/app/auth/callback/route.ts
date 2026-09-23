import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Force dynamic rendering — cookie reads must run at request time, never from cache
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  // Optional post-auth destination, threaded through from the login page.
  // Only accepted as a relative path (must start with '/') to prevent open-redirect.
  const nextParam = request.nextUrl.searchParams.get('next') ?? ''
  const safeNext = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : ''

  const origin = request.nextUrl.origin

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', origin))
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
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

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    console.error('Auth exchange error:', exchangeError.message)
    // pkce_code_verifier_not_found means the verifier cookie was gone by the
    // time the callback ran (tab refreshed, second OAuth attempt overwrote it,
    // etc.).  It's fully recoverable — surface a distinct code so the login
    // page can show a more actionable message instead of a generic failure.
    const errorCode =
      exchangeError.code === 'pkce_code_verifier_not_found'
        ? 'session_expired'
        : 'auth_failed'
    return NextResponse.redirect(new URL(`/login?error=${errorCode}`, origin))
  }

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
