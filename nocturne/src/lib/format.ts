/**
 * Formats a byte count as a human-readable storage string.
 *
 * - Under 1024 MB → "X MB" (rounded, no decimal)
 * - At or above 1024 MB → "X.X GB" (one decimal, ".0" stripped to whole number)
 *
 * Examples: 2_097_152 → "2 MB", 5_154_717_696 → "4.8 GB", 21_474_836_480 → "20 GB"
 */
export function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  if (mb < 1024) return `${Math.round(mb)} MB`
  const gb = mb / 1024
  const s = gb.toFixed(1)
  return `${s.endsWith('.0') ? String(Math.round(gb)) : s} GB`
}
