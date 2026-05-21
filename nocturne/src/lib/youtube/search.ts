// YouTube Data API v3 — Mode A: keyword search.
// Rate-limited to 1 request per 500ms to protect quota.
// Returns graceful null when API key is absent.

import { getYouTubeApiKey } from './config'

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VideoResult {
  videoId: string
  title: string
  channelName: string
  thumbnailUrl: string
}

// ─── Rate limiter ─────────────────────────────────────────────────────────────

let lastRequestTime = 0

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now()
  const elapsed = now - lastRequestTime
  if (elapsed < 500) {
    await new Promise((r) => setTimeout(r, 500 - elapsed))
  }
  lastRequestTime = Date.now()
  return fetch(url)
}

// ─── Search ───────────────────────────────────────────────────────────────────

/**
 * Searches YouTube for a single keyword.
 * Returns null if API key is absent or quota is exceeded.
 * Throws on unexpected network errors.
 */
export async function searchKeyword(
  keyword: string,
): Promise<VideoResult[] | null> {
  const key = getYouTubeApiKey()
  if (!key) return null

  const q = encodeURIComponent(`${keyword} lecture OR explained`)
  const url =
    `${YOUTUBE_API_BASE}/search` +
    `?part=snippet&q=${q}&type=video&relevanceLanguage=en&maxResults=3&key=${key}`

  const res = await rateLimitedFetch(url)

  if (res.status === 403) return null  // quota exceeded or key invalid — caller shows amber warning
  if (!res.ok) throw new Error(`YouTube API error: ${res.status}`)

  const json = await res.json() as {
    items?: Array<{
      id: { videoId: string }
      snippet: {
        title: string
        channelTitle: string
        thumbnails: { medium?: { url: string }; default?: { url: string } }
      }
    }>
  }

  return (json.items ?? []).map((item) => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
    channelName: item.snippet.channelTitle,
    thumbnailUrl:
      item.snippet.thumbnails.medium?.url ??
      item.snippet.thumbnails.default?.url ??
      '',
  }))
}

/**
 * Searches YouTube for each keyword in sequence (rate-limited).
 * Results are deduplicated by videoId.
 * Returns [] if API key is absent.
 * Returns null if quota was exceeded mid-run.
 */
export async function searchMultipleKeywords(
  keywords: string[],
): Promise<VideoResult[] | null> {
  const key = getYouTubeApiKey()
  if (!key) return []

  const seen = new Set<string>()
  const results: VideoResult[] = []

  for (const kw of keywords) {
    const kwResults = await searchKeyword(kw)
    if (kwResults === null) return null  // quota hit — propagate signal
    for (const v of kwResults) {
      if (!seen.has(v.videoId)) {
        seen.add(v.videoId)
        results.push(v)
      }
    }
  }

  return results
}
