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

// Copy any cookies that were set on `source` (e.g. a refreshed Supabase
// session token) onto `dest` before returning it.  Without this, a token
// refresh that happens inside getUser() is silently dropped whenever the
// middleware returns a redirect instead of passing the request through —
// the consumed refresh token never reaches the browser, so the next
// server component that tries to use it gets a 401 from Supabase and
// cascades to /login.
function withCookies(dest: NextResponse, source: NextResponse): NextResponse {
  source.cookies.getAll().forEach((cookie) => dest.cookies.set(cookie))
  return dest
}

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

  // Not logged in — send to login, carrying any refreshed cookies so the
  // browser has the latest token state even on an unauthenticated redirect.
  if (!user) {
    return withCookies(
      NextResponse.redirect(new URL('/login', request.url)),
      supabaseResponse,
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
    // Carry refreshed cookies onto the redirect so the token rotation that
    // may have just happened inside getUser() reaches the browser.  Without
    // this, the unlock page receives the already-consumed refresh token and
    // redirects straight to /login.
    return withCookies(
      NextResponse.redirect(
        new URL(`/unlock?next=${next}`, request.url),
      ),
      supabaseResponse,
    )
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/vault/:path*',
    '/session/:path*',
    '/momentum/:path*',
    '/community/:path*',
    '/billing/:path*',
  ],
}