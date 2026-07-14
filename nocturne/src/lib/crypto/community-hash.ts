// Client-side SHA-256 helpers for community privacy.
// Must produce identical hex output to the server-side pgcrypto functions.

async function sha256hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const buf  = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Anonymous identity for a user in a specific room. Matches compute_member_hash() in Postgres. */
export function hashMemberId(userId: string, roomId: string): Promise<string> {
  return sha256hex(`${userId}:${roomId}`)
}

/** Privacy-preserving hash of a keyword term within a room. Salt is the room (not the user). */
export function hashPoolTerm(roomId: string, term: string): Promise<string> {
  return sha256hex(`${roomId}:${term.toLowerCase().trim()}`)
}
