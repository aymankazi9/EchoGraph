// Fire-and-forget logging wrapper for every Anthropic API call.
// Logs token counts and latency to llm_usage — never logs prompt or response content.
//
// Usage:
//   const data = await callAnthropic({ model, max_tokens, system, messages,
//                                      route: 'extract/keywords',
//                                      userId: user.id, sessionId, supabase })
//   const text = data.content.find(b => b.type === 'text')?.text ?? ''

import type { SupabaseClient } from '@supabase/supabase-js'

export interface AnthropicMessage {
  role: 'user' | 'assistant'
  /** Plain string for text-only messages; content-block array for vision/document requests. */
  content: string | unknown[]
}

export interface AnthropicResponse {
  content: { type: string; text: string }[]
  usage: { input_tokens: number; output_tokens: number }
}

export interface AnthropicCallParams {
  model: string
  max_tokens: number
  system: string
  messages: AnthropicMessage[]
  /** Sampling temperature. Omit to use the model default (currently 1.0). Pass 0 for fully deterministic output. */
  temperature?: number
  // ── Logging metadata ──────────────────────────────────────────────────────
  /** Route identifier logged in llm_usage, e.g. "extract/keywords". */
  route: string
  userId: string
  /** Set when the call is tied to a single session; null for vault/course-wide calls. */
  sessionId?: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>
}

export async function callAnthropic(params: AnthropicCallParams): Promise<AnthropicResponse> {
  const { model, max_tokens, system, messages, temperature, route, userId, sessionId, supabase } = params

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')

  const startMs = Date.now()
  let logged = false

  // Called exactly once per request, even on re-throw paths.
  const log = (
    status: 'ok' | 'error',
    inputTokens: number,
    outputTokens: number,
    errorCode: string | null,
  ) => {
    if (logged) return
    logged = true
    const latencyMs = Date.now() - startMs
    void supabase
      .from('llm_usage')
      .insert({
        user_id: userId,
        session_id: sessionId ?? null,
        route,
        model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        latency_ms: latencyMs,
        status,
        error_code: errorCode,
      })
      .then(({ error }: { error: { message: string } | null }) => {
        if (error) console.error('[llm_usage] log failed:', error.message)
      })
  }

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model, max_tokens, system, messages,
        ...(temperature !== undefined && { temperature }),
      }),
    })

    if (!resp.ok) {
      const errText = await resp.text()
      log('error', 0, 0, `http_${resp.status}`)
      throw new Error(`Anthropic ${resp.status}: ${errText}`)
    }

    const data = await resp.json() as AnthropicResponse
    log('ok', data.usage?.input_tokens ?? 0, data.usage?.output_tokens ?? 0, null)
    return data
  } catch (err) {
    // Network error or JSON parse failure — log only if not already logged above.
    log('error', 0, 0, 'network_error')
    throw err
  }
}
