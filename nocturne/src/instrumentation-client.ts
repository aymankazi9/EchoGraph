// Next.js client instrumentation hook — runs in the browser before any pages.
// Registers the Sentry browser SDK for client-side error and performance monitoring.

import * as Sentry from '@sentry/nextjs'
import '../sentry.client.config'

// Required by Sentry to capture router transition spans.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
