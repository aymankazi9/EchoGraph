// Sentry Node.js SDK — runs in Server Components, Route Handlers, Server Actions.
// Error monitoring stays on permanently; it is never toggled off.
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: 0.1,

  enabled: process.env.NODE_ENV === 'production',
})
