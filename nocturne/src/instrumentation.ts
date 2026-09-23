// Next.js instrumentation hook — runs once at server startup before any routes.
// Used to initialise Sentry (permanent, independent of BETA_MODE) and to run
// the beta-mode safety check that prevents a live Stripe key being used with
// BETA_MODE=true.

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config')
  }

  // ── Beta-mode safety check ──────────────────────────────────────────────
  // Importing beta.ts triggers the top-level throw if the config is invalid.
  // We only do this on Node.js (not Edge) to avoid duplicate logging.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./lib/beta')
  }
}
