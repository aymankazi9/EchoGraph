import type { Tier } from './features'

// Resolves Stripe Price IDs ↔ application Tiers.
//
// Each env var may hold a single Price ID or a comma-separated list —
// useful when a tier has multiple prices (e.g. monthly and yearly intervals).
// Test-mode and live-mode IDs differ only in environment config,
// with no code changes required to switch.
//
// STRIPE_PRICE_ID_MIDNIGHT — price(s) that map to the 'midnight' tier
// STRIPE_PRICE_ID_ECLIPSE  — price(s) that map to the 'eclipse' tier

function parsePriceIds(raw: string | undefined): string[] {
  return (raw ?? '').split(',').map((s) => s.trim()).filter(Boolean)
}

const midnight = parsePriceIds(process.env.STRIPE_PRICE_ID_MIDNIGHT)
const eclipse  = parsePriceIds(process.env.STRIPE_PRICE_ID_ECLIPSE)

// Price ID → Tier (for webhook tier resolution)
const PRICE_TO_TIER: ReadonlyMap<string, Tier> = new Map<string, Tier>([
  ...midnight.map((id): [string, Tier] => [id, 'midnight']),
  ...eclipse.map((id):  [string, Tier] => [id, 'eclipse']),
])

// Tier → first Price ID (for checkout session creation)
// If a tier has multiple prices (monthly + yearly) the first listed is used
// as the default; callers that need a specific interval should pass it explicitly.
const TIER_TO_PRICE: ReadonlyMap<Tier, string> = new Map<Tier, string>([
  ...(midnight[0] ? [['midnight', midnight[0]] as [Tier, string]] : []),
  ...(eclipse[0]  ? [['eclipse',  eclipse[0]]  as [Tier, string]] : []),
])

/**
 * Returns the Tier for a given Stripe Price ID, or null if unknown.
 *
 * Callers MUST treat null as a configuration error — do not fall back to
 * 'dusk'.  Silently downgrading a paying customer on a misconfiguration
 * hides the bug; loud failure surfaces it.
 */
export function tierForPriceId(priceId: string): Tier | null {
  return PRICE_TO_TIER.get(priceId) ?? null
}

/**
 * Returns the first Stripe Price ID configured for a given Tier, or null if
 * the tier has no price configured (always true for 'dusk').
 */
export function priceIdForTier(tier: Tier): string | null {
  return TIER_TO_PRICE.get(tier) ?? null
}
