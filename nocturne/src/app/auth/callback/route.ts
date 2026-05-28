import { NextRequest, NextResponse } 
  from 'next/server'
import { createServerClient } 
  from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(
  request: NextRequest
) {
  const code = 
    request.nextUrl.searchParams
      .get('code')
  const origin = request.nextUrl.origin

  if (!code) {
    return NextResponse.redirect(
      new URL('/login?error=missing_code', 
        origin)
    )
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
            cookiesToSet.forEach(
              ({ name, value, options }) =>
                cookieStore.set(
                  name, 
                  value, 
                  options
                )
            )
          } catch {
            /* Route Handler can set 
               cookies — this catch is 
               a safety net for edge 
               cases only */
          }
        },
      },
    }
  )

  const { error: exchangeError } = 
    await supabase.auth
      .exchangeCodeForSession(code)

  if (exchangeError) {
    console.error(
      'Auth exchange error:', 
      exchangeError.message
    )
    return NextResponse.redirect(
      new URL(
        '/login?error=auth_failed', 
        origin
      )
    )
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(
      new URL('/login', origin)
    )
  }

  /* Check if first-time or 
     returning user */
  const { data: profile } = 
    await supabase
      .from('users')
      .select('pbkdf2_salt')
      .eq('id', user.id)
      .single()

  const destination = 
    profile?.pbkdf2_salt 
      ? '/vault/unlock' 
      : '/vault/setup'

  return NextResponse.redirect(
    new URL(destination, origin)
  )
}