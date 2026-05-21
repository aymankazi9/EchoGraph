// YouTube API key intentionally empty for MVP.
// Set NEXT_PUBLIC_YOUTUBE_API_KEY in .env.local to activate.
// Requires Scholar tier consent gate.

export function getYouTubeApiKey(): string | null {
  return process.env.NEXT_PUBLIC_YOUTUBE_API_KEY ?? null
}
