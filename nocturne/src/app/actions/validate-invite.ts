'use server'

/**
 * Validates a beta invite code server-side.
 * BETA_INVITE_CODE is intentionally NOT prefixed with NEXT_PUBLIC_ — it must
 * never appear in the client bundle.
 *
 * Returns { ok: true } on a match, { ok: false, error: string } otherwise.
 */
export async function validateInviteCode(
  code: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const expected = process.env.BETA_INVITE_CODE

  // If BETA_MODE is off or no code is configured, allow all signups.
  if (process.env.BETA_MODE !== 'true' || !expected) {
    return { ok: true }
  }

  if (!code.trim()) {
    return { ok: false, error: 'Invite code is required.' }
  }

  // Constant-time comparison would be ideal for high-value secrets; for a
  // single shared beta code, exact equality is sufficient.
  if (code.trim() !== expected) {
    return { ok: false, error: 'Invalid invite code.' }
  }

  return { ok: true }
}
