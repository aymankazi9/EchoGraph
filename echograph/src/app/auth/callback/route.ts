import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const origin = request.nextUrl.origin

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', origin))
  }

  const supabase = await createServerClient()
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    return NextResponse.redirect(new URL('/login?error=auth_failed', origin))
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', origin))
  }

  const { data: profile } = await supabase
    .from('users')
    .select('pbkdf2_salt')
    .eq('id', user.id)
    .single()

  // No salt = first-time signup, needs vault setup.
  // Salt present = returning user, needs to unlock vault.
  const destination = profile?.pbkdf2_salt ? '/unlock' : '/setup'
  return NextResponse.redirect(new URL(destination, origin))
}
