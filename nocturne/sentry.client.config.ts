// Sentry browser SDK — runs in every page, independent of BETA_MODE.
// Error monitoring stays on permanently; it is never toggled off.
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Capture all unhandled exceptions and promise rejections.
  // Adjust tracesSampleRate (0–1) to control performance-trace volume in production.
  tracesSampleRate: 0.1,

  // Only send events in production to avoid noise from local dev.
  enabled: process.env.NODE_ENV === 'production',

  // Breadcrumbs give context around errors without capturing PII.
  beforeBreadcrumb(breadcrumb) {
    // Drop fetch breadcrumbs that include query params from Supabase storage
    // URLs — those can contain signed-URL tokens.
    if (breadcrumb.category === 'fetch' && breadcrumb.data?.url?.includes('supabase')) {
      return null
    }
    return breadcrumb
  },
})
