export type Tier = 'dusk' | 'midnight' | 'eclipse'

// Higher ordinal = higher tier. Used for >= comparisons.
export const TIER_ORDINAL: Record<Tier, number> = {
  dusk: 0,
  midnight: 1,
  eclipse: 2,
}

export function hasAccess(userTier: Tier, requiredTier: Tier): boolean {
  return TIER_ORDINAL[userTier] >= TIER_ORDINAL[requiredTier]
}

// Maximum encrypted-file storage per tier, in bytes.
export const STORAGE_CAPS_BYTES: Record<Tier, number> = {
  dusk:     500  * 1024 * 1024,        //  500 MB
  midnight:   5  * 1024 * 1024 * 1024, //    5 GB
  eclipse:   20  * 1024 * 1024 * 1024, //   20 GB
}
