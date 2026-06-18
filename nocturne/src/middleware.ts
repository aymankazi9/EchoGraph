import { createServerClient } 
  from '@supabase/ssr'
import { 
  NextResponse, 
  type NextRequest 
} from 'next/server'

const url = 
  process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Routes that bypass auth entirely
const PUBLIC_PATHS = [
  '/login',
  '/auth/callback',
  '/setup',
  '/unlock',
]

// Routes that need auth but NOT
// the vault-warm cookie
// (user is authenticated but
// vault not yet unlocked)
const AUTH_ONLY_PATHS = [
  '/setup',
  '/unlock',
]

export async function middleware(
  request: NextRequest
) {
  const pathname = 
    request.nextUrl.pathname

  // Bypass middleware entirely 
  // for public paths
  const isPublicPath = 
    PUBLIC_PATHS.some(p => 
      pathname.startsWith(p)
    )

  if (isPublicPath) {
    return NextResponse.next()
  }

  let supabaseResponse = 
    NextResponse.next({ request })

  const supabase = createServerClient(
    url, 
    anonKey, 
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(
            ({ name, value }) => 
              request.cookies.set(
                name, value
              )
          )
          supabaseResponse = 
            NextResponse.next({ request })
          cookiesToSet.forEach(
            ({ name, value, options }) =>
              supabaseResponse.cookies.set(
                name, value, options
              )
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Not logged in — send to login
  if (!user) {
    return NextResponse.redirect(
      new URL('/login', request.url)
    )
  }

  // Logged in but vault not warm —
  // send to unlock with return path
  const vaultWarm = 
    request.cookies
      .get('nocturne-vault-warm')
      ?.value

  if (!vaultWarm) {
    const isAuthOnlyPath = 
      AUTH_ONLY_PATHS.some(p =>
        pathname.startsWith(p)
      )

    // Already on setup/unlock — 
    // let them through
    if (isAuthOnlyPath) {
      return supabaseResponse
    }

    const next = encodeURIComponent(
      request.nextUrl.pathname + 
      request.nextUrl.search
    )
    return NextResponse.redirect(
      new URL(
        `/unlock?next=${next}`,
        request.url
      )
    )
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/vault/:path*', 
    '/session/:path*',
  ],
}