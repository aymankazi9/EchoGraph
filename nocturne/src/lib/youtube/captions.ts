// YouTube Data API v3 — Mode B: caption fetch + keyword matching.
// captions.list checks for ASR tracks; timedtext fetches raw VTT.
// Note: timedtext endpoint is unofficial and may be blocked by CORS in browser.
// Scholar tier will proxy this via a Supabase Edge Function.

import { getYouTubeApiKey } from './config'
import type { StoredKeyword } from '@/store/session-store'

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CaptionMatch {
  keyword: StoredKeyword
  sentence: string
}

export type CaptionError =
  | 'no_captions'
  | 'cors_blocked'
  | 'invalid_url'
  | 'no_matches'
  | 'api_error'

// ─── URL → videoId ────────────────────────────────────────────────────────────

export function extractVideoId(url: string): string | null {
  try {
    const parsed = new URL(url)
    // https://www.youtube.com/watch?v=ID
    if (parsed.hostname.includes('youtube.com') && parsed.searchParams.has('v')) {
      return parsed.searchParams.get('v')
    }
    // https://youtu.be/ID
    if (parsed.hostname === 'youtu.be') {
      return parsed.pathname.slice(1) || null
    }
    // https://www.youtube.com/embed/ID or /shorts/ID
    const match = parsed.pathname.match(/\/(embed|shorts)\/([^/?]+)/)
    if (match) return match[2]
  } catch {
    return null
  }
  return null
}

// ─── captions.list ────────────────────────────────────────────────────────────

async function hasAsrCaptions(videoId: string, key: string): Promise<boolean> {
  const url =
    `${YOUTUBE_API_BASE}/captions?part=snippet&videoId=${encodeURIComponent(videoId)}&key=${key}`

  const res = await fetch(url)
  if (!res.ok) return false

  const json = await res.json() as {
    items?: Array<{ snippet: { trackKind: string; language: string } }>
  }

  return (json.items ?? []).some(
    (t) => t.snippet.trackKind === 'asr' || t.snippet.trackKind === 'standard',
  )
}

// ─── VTT fetcher (unofficial timedtext API) ───────────────────────────────────

async function fetchVttText(videoId: string): Promise<string> {
  const url = `https://www.youtube.com/api/timedtext?v=${encodeURIComponent(videoId)}&lang=en&fmt=vtt`
  const res = await fetch(url)
  if (!res.ok) throw new Error('cors_blocked')
  return res.text()
}

// ─── VTT parser ───────────────────────────────────────────────────────────────

/** Extracts clean sentence strings from a WebVTT document. */
export function parseCaptionText(vtt: string): string[] {
  const sentences: string[] = []
  // Split into blocks by blank lines
  const blocks = vtt.split(/\n\s*\n/)

  for (const block of blocks) {
    const lines = block.trim().split('\n')
    // Skip WEBVTT header and empty blocks
    if (!lines.length || lines[0].startsWith('WEBVTT') || lines[0].startsWith('Kind:')) continue
    // Skip blocks that are just a timestamp or cue id (number)
    const textLines = lines.filter(
      (l) => l.trim() && !l.includes('-->') && !/^\d+$/.test(l.trim()),
    )
    if (textLines.length === 0) continue

    const text = textLines.join(' ').replace(/<[^>]+>/g, '').trim()
    if (text.length >= 10) sentences.push(text)
  }

  return sentences
}

// ─── Keyword matcher ──────────────────────────────────────────────────────────

/**
 * Returns the best (longest) sentence for each Red Zone keyword found in captions.
 * Only Red Zone keywords are matched — Likely Zone terms are excluded.
 */
export function matchCaptionsToKeywords(
  sentences: string[],
  keywords: StoredKeyword[],
): CaptionMatch[] {
  const redZone = keywords.filter((k) => k.zone === 'red')
  const matches: CaptionMatch[] = []

  for (const kw of redZone) {
    const lower = kw.term.toLowerCase()
    let bestSentence = ''
    for (const s of sentences) {
      if (s.toLowerCase().includes(lower) && s.length > bestSentence.length) {
        bestSentence = s
      }
    }
    if (bestSentence) matches.push({ keyword: kw, sentence: bestSentence })
  }

  return matches
}

// ─── Public orchestrator ─────────────────────────────────────────────────────

/**
 * Full pipeline: URL → videoId → check captions → fetch VTT → parse → match.
 * On CORS failure, throws with error code 'cors_blocked'.
 */
export async function fetchCaptionTrack(
  videoUrl: string,
  keywords: StoredKeyword[],
): Promise<CaptionMatch[]> {
  const videoId = extractVideoId(videoUrl)
  if (!videoId) throw Object.assign(new Error('invalid_url'), { code: 'invalid_url' })

  const key = getYouTubeApiKey()
  if (!key) throw Object.assign(new Error('api_error'), { code: 'api_error' })

  // Check if captions exist via official API
  const hasCaptions = await hasAsrCaptions(videoId, key)
  if (!hasCaptions) throw Object.assign(new Error('no_captions'), { code: 'no_captions' })

  // Fetch raw VTT — may throw 'cors_blocked' if CORS headers absent
  let vtt: string
  try {
    vtt = await fetchVttText(videoId)
  } catch {
    throw Object.assign(new Error('cors_blocked'), { code: 'cors_blocked' })
  }

  const sentences = parseCaptionText(vtt)
  const matches = matchCaptionsToKeywords(sentences, keywords)

  if (matches.length === 0) {
    throw Object.assign(new Error('no_matches'), { code: 'no_matches' })
  }

  return matches
}
